import json
import re
import struct
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
INPUT = re.compile(r'^(JOY_BTN\d{1,3}|JOY_BTN_POV[1-4]_(U|UR|R|DR|D|DL|L|UL)|JOY_(X|Y|Z|RX|RY|RZ|SLIDER1|SLIDER2)|MOUSE_(BTN\d|X|Y|Z)|[^\s]{1,16})$')
ROLES = {'stick', 'throttle', 'pedals', 'panel', 'other', 'keyboard', 'mouse'}
IMAGES = {'.png', '.jpg', '.jpeg', '.webp', '.svg'}
NAME = re.compile(r'^[\w][\w .+()&-]{0,63}$')
MAX_IMAGE_BYTES = 3 * 1024 * 1024
UI_LAYER = 'UiLayer'

def image_size(file):
    data = file.read_bytes()
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return struct.unpack('>II', data[16:24])
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        chunk = data[12:16]
        if chunk == b'VP8X':
            return 1 + int.from_bytes(data[24:27], 'little'), 1 + int.from_bytes(data[27:30], 'little')
        if chunk == b'VP8L':
            bits = int.from_bytes(data[21:25], 'little')
            return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
        return struct.unpack('<HH', data[26:30])[0] & 0x3FFF, struct.unpack('<HH', data[26:30])[1] & 0x3FFF
    if data[:2] == b'\xff\xd8':
        i = 2
        while i < len(data):
            marker, length = data[i + 1], struct.unpack('>H', data[i + 2:i + 4])[0]
            if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
                height, width = struct.unpack('>HH', data[i + 5:i + 9])
                return width, height
            i += 2 + length
    if file.suffix.lower() == '.svg':
        text = data.decode('utf-8', 'ignore')
        box = re.search(r'viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)', text)
        if box:
            return round(float(box.group(1))), round(float(box.group(2)))
    return None

def read_json(file, errors, where):
    try:
        return json.loads(file.read_text(encoding='utf-8'))
    except FileNotFoundError:
        errors.append(f'{where}: {file.name} is missing')
    except json.JSONDecodeError as error:
        errors.append(f'{where}/{file.name}: not valid JSON ({error})')
    return None

def number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)

def check_crop(where, frame, pictures, errors):
    if frame.get('picture') not in pictures:
        errors.append(f'{where}: picture "{frame.get("picture")}" is not listed in "pictures"')
    x, y, w, h = (frame.get(k, d) for k, d in (('x', 0), ('y', 0), ('w', 100), ('h', 100)))
    if not all(number(v) for v in (x, y, w, h)) or w <= 0 or h <= 0 or x < 0 or y < 0 or x + w > 100.001 or y + h > 100.001:
        errors.append(f'{where}: x, y, w, h are percentages of the picture and must stay inside it')

def check_frame(where, frame, pictures, errors):
    if not isinstance(frame, dict):
        errors.append(f'{where}: must be an object')
        return
    if 'layers' not in frame:
        check_crop(where, frame, pictures, errors)
        return
    size = frame.get('size')
    if not (isinstance(size, list) and len(size) == 2 and all(number(v) and v > 0 for v in size)):
        errors.append(f'{where}: a view made of layers needs "size": [width, height]')
    for i, layer in enumerate(frame.get('layers') or []):
        check_crop(f'{where} layer {i + 1}', layer, pictures, errors)
        at = layer.get('at')
        if not (isinstance(at, list) and len(at) == 3 and all(number(v) for v in at) and at[2] > 0):
            errors.append(f'{where} layer {i + 1}: "at" is [x, y, width] in percent of the view')

def check_device(folder, errors):
    where = f'devices/{folder.parent.name}/{folder.name}'
    for name in (folder.parent.name, folder.name):
        if not NAME.match(name):
            errors.append(f'{where}: folder name "{name}" may use letters, digits, spaces and + . ( ) & - only')
    device = read_json(folder / 'device.json', errors, where)
    if device is None:
        return
    for key in ('name', 'role', 'dcsName', 'pictures', 'card', 'views'):
        if key not in device:
            errors.append(f'{where}/device.json: "{key}" is missing')
    if device.get('role') not in ROLES:
        errors.append(f'{where}: "role" must be one of {sorted(ROLES)}')
    if '{' in device.get('dcsName', ''):
        errors.append(f'{where}: "dcsName" is the name without the {{GUID}} part')
    pictures = device.get('pictures') or {}
    for name, picture in pictures.items():
        file = folder / name
        if not file.is_file():
            errors.append(f'{where}: picture "{name}" is missing')
            continue
        if file.suffix.lower() not in IMAGES:
            errors.append(f'{where}: "{name}" must be one of {sorted(IMAGES)}')
        if file.stat().st_size > MAX_IMAGE_BYTES:
            errors.append(f'{where}: "{name}" is larger than 3 MB')
        actual = image_size(file)
        if actual and list(actual) != picture.get('size'):
            errors.append(f'{where}: "{name}" is {actual[0]}x{actual[1]}, so its "size" must be [{actual[0]}, {actual[1]}]')
        seen = set()
        for mark in picture.get('marks') or []:
            key = mark.get('input', '')
            if not INPUT.match(key):
                errors.append(f'{where}: {name}: "{key}" is not a DCS input name')
            if key in seen:
                errors.append(f'{where}: {name}: "{key}" is placed twice')
            seen.add(key)
            if not (number(mark.get('x')) and number(mark.get('y')) and -100 <= mark['x'] <= 200 and -100 <= mark['y'] <= 200):
                errors.append(f'{where}: {name}: "{key}" needs x and y in percent of the picture')
    check_frame(f'{where}: card', device.get('card'), pictures, errors)
    for i, view in enumerate(device.get('views') or []):
        if not view.get('name'):
            errors.append(f'{where}: view {i + 1} needs a "name"')
        check_frame(f'{where}: view "{view.get("name", i + 1)}"', view, pictures, errors)
    extra = {p.name for p in folder.iterdir()} - set(pictures) - {'device.json'}
    if extra:
        errors.append(f'{where}: files not used by device.json: {sorted(extra)}')

def check_aircraft(folder, errors):
    where = f'aircraft/{folder.name}'
    catalogue = read_json(folder / 'aircraft.json', errors, where)
    if catalogue is None:
        return
    for key in ('id', 'folder', 'name', 'commands', 'defaults', 'profiles', 'presets'):
        if key not in catalogue:
            errors.append(f'{where}/aircraft.json: "{key}" is missing')
    if catalogue.get('folder') != folder.name:
        errors.append(f'{where}: the folder must be named "{catalogue.get("folder")}"')
    for kind in ('key', 'axis'):
        if any(not {'hash', 'name', 'category'} <= c.keys() for c in catalogue.get('commands', {}).get(kind, [])):
            errors.append(f'{where}: a {kind} command lacks hash, name or category')
    if '' not in catalogue.get('defaults', {}):
        errors.append(f'{where}: "defaults" needs the generic "" entry')
    for file in sorted((folder / 'l10n').glob('*')):
        words = read_json(file, errors, f'{where}/l10n')
        if words is not None and not (isinstance(words, dict) and all(isinstance(v, str) for v in words.values())):
            errors.append(f'{where}/l10n/{file.name}: must map each English name to its translation')

def check_locale(file, english, errors):
    where = f'locales/{file.name}'
    words = read_json(file, errors, 'locales')
    if words is None:
        return
    for key in ('language.name', 'language.label'):
        if not words.get(key):
            errors.append(f'{where}: "{key}" is missing (the language as its speakers write it, and a 2-3 letter label)')
    unknown = sorted(set(words) - set(english))
    if unknown:
        errors.append(f'{where}: keys not in en.json: {unknown[:5]}')

def main():
    errors = []
    for folder in sorted(p for p in (REPO / 'devices').glob('*/*') if p.is_dir()):
        check_device(folder, errors)
    for folder in sorted(p for p in (REPO / 'aircraft').iterdir() if p.is_dir()):
        check_aircraft(folder, errors)
    english = json.loads((REPO / 'locales' / 'en.json').read_text(encoding='utf-8'))
    for file in sorted((REPO / 'locales').glob('*.json')):
        check_locale(file, english, errors)
    for line in errors:
        print(line)
    print('ok' if not errors else f'{len(errors)} problem(s)')
    return 1 if errors else 0

if __name__ == '__main__':
    sys.exit(main())
