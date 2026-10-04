import argparse
import json
import math
import re
import struct
import zlib
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / 'devices'
DEFAULT_COCKPIT = Path(r'C:\Program Files (x86)\MOZA Cockpit')
LABEL = 22
POV_DIRECTIONS = ['U', 'UR', 'R', 'DR', 'D', 'DL', 'L', 'UL']
MH16_AXES = [{'input': 'JOY_X', 'x': 813, 'y': 760}, {'input': 'JOY_Y', 'x': 370, 'y': 760}]
MTQ_AXES = {'Dial': 'JOY_SLIDER2', 'Slider': 'JOY_SLIDER1', 'RX': 'JOY_RX', 'RY': 'JOY_RY', 'X': 'JOY_X', 'Y': 'JOY_Y'}

def qt_hash(text):
    h = 0
    for ch in text:
        h = ((h << 4) + ord(ch)) & 0xffffffff
        h ^= (h & 0xf0000000) >> 23
        h &= 0x0fffffff
    return h

def qt_resources(binary):
    data = binary.read_bytes()

    def name_at(offset):
        if offset + 6 > len(data):
            return None
        length = struct.unpack_from('>H', data, offset)[0]
        if not 0 < length < 200:
            return None
        try:
            text = data[offset + 6:offset + 6 + 2 * length].decode('utf-16-be')
        except UnicodeDecodeError:
            return None
        return text if qt_hash(text) == struct.unpack_from('>I', data, offset + 2)[0] else None

    names = {}
    for match in re.finditer(rb'(?:\x00[\x20-\x7e]){3,}', data):
        if name := name_at(match.start() - 6):
            names[match.start() - 6] = name
    tables, covered = [], set()
    for start in sorted(names):
        if start in covered:
            continue
        table, offset = [], start
        while (name := name_at(offset)) is not None:
            table.append(offset)
            offset += 6 + 2 * len(name)
        covered.update(table)
        if tables and table and table[0] - tables[-1][-1] < 512:
            tables[-1].extend(table)
        elif len(table) > 3:
            tables.append(table)

    files = {}
    for table in tables:
        base = table[0]
        relative = {o - base: name_at(o) for o in table}
        for match in re.finditer(re.escape(struct.pack('>IH', 0, 2)), data):
            tree = match.start()
            count, first = struct.unpack_from('>II', data, tree + 6)
            if not (0 < count < 5000 and first == 1):
                continue
            if not all(struct.unpack_from('>I', data, tree + 22 * i)[0] in relative for i in range(1, 1 + min(count, 5))):
                continue
            nodes = []

            def walk(index, path):
                node = tree + 22 * index
                name_offset, flags = struct.unpack_from('>IH', data, node)
                name = relative.get(name_offset, '') if index else ''
                full = f'{path}/{name}' if name else path
                if flags & 2:
                    children, first_child = struct.unpack_from('>II', data, node + 6)
                    for child in range(first_child, first_child + children):
                        walk(child, full)
                else:
                    nodes.append((full, flags, struct.unpack_from('>I', data, node + 10)[0]))

            try:
                walk(0, '')
            except (struct.error, RecursionError):
                continue
            pngs = [(p, o) for p, f, o in nodes if p.endswith('.png') and f == 0]
            if not pngs:
                continue
            data_base = None
            for png in re.finditer(re.escape(b'\x89PNG'), data):
                candidate = png.start() - 4 - pngs[0][1]
                if candidate >= 0 and all(data[candidate + o + 4:candidate + o + 8] == b'\x89PNG' for _, o in pngs[:20]):
                    data_base = candidate
                    break
            if data_base is None:
                continue
            for path, flags, offset in nodes:
                length = struct.unpack_from('>I', data, data_base + offset)[0]
                blob = data[data_base + offset + 4:data_base + offset + 4 + length]
                if flags & 4:
                    continue
                files[path] = zlib.decompress(blob[4:]) if flags & 1 else blob
            break
    return files

def strip_comment(line):
    quote = None
    for i, ch in enumerate(line):
        if quote:
            if ch == quote and line[i - 1] != '\\':
                quote = None
        elif ch in '"\'':
            quote = ch
        elif line.startswith('//', i):
            return line[:i]
    return line

def net_braces(text):
    text = re.sub(r'"(?:[^"\\]|\\.)*"', '', text)
    return text.count('{') - text.count('}')

def parse_qml(text):
    root = {'type': None, 'props': {}, 'children': []}
    stack = [root]
    last = None
    for raw in text.splitlines():
        line = strip_comment(raw).strip()
        if not line:
            continue
        node = stack[-1]
        if last and line[0] in '?:' and not re.match(r'^[\w.]+\s*:', line):
            node['props'][last] += ' ' + line
            continue
        last = None
        if element := re.match(r'^([A-Z][\w.]*)\s*\{(.*)$', line):
            child = {'type': element.group(1), 'props': {}, 'children': []}
            node['children'].append(child)
            stack.append(child)
            delta = net_braces(element.group(2))
            for _ in range(max(delta, 0)):
                anonymous = {'type': None, 'props': {}, 'children': []}
                stack[-1]['children'].append(anonymous)
                stack.append(anonymous)
            for _ in range(max(-delta, 0)):
                stack.pop()
            continue
        if prop := re.match(r'^(?:readonly\s+)?(?:property\s+[\w<>]+\s+)?([\w.]+)\s*:\s*(.*)$', line):
            key, value = prop.groups()
            delta = net_braces(value)
            if delta > 0:
                inline = re.match(r'^([A-Z][\w.]*)\s*\{', value)
                for depth in range(delta):
                    child = {'type': inline.group(1) if inline and not depth else None, 'props': {}, 'children': []}
                    stack[-1]['children'].append(child)
                    stack.append(child)
            else:
                node['props'][key] = value.rstrip(';')
                last = key
            continue
        delta = net_braces(line)
        for _ in range(max(delta, 0)):
            child = {'type': None, 'props': {}, 'children': []}
            stack[-1]['children'].append(child)
            stack.append(child)
        for _ in range(max(-delta, 0)):
            if len(stack) > 1:
                stack.pop()
    return root

def evaluate(expression, context):
    text = expression
    for name in sorted(context, key=len, reverse=True):
        text = text.replace(name, repr(context[name]))
    text = text.replace('!==', '!=').replace('===', '==').replace('||', ' or ').replace('&&', ' and ')
    text = re.sub(r'!(?!=)', ' not ', text).replace('true', 'True').replace('false', 'False')
    if '?' in text:
        condition, branches = text.split('?', 1)
        when_true, when_false = branches.split(':', 1)
        text = f'({when_true}) if ({condition}) else ({when_false})'
    if re.search(r'[A-Za-z_]', re.sub(r'\b(?:or|and|not|if|else|True|False)\b', '', text)):
        raise ValueError(expression)
    return eval(text, {'__builtins__': {}}, {})

def number(node, key, context, default=0.0):
    value = node['props'].get(key)
    return float(evaluate(value, context)) if value is not None else default

def visible(node, context):
    value = node['props'].get('visible')
    if value is None:
        return True
    try:
        return bool(evaluate(value, context))
    except (ValueError, SyntaxError, NameError):
        return True

def find(node, predicate):
    if predicate(node):
        return node
    for child in node['children']:
        if found := find(child, predicate):
            return found
    return None

def light_source(value):
    sources = re.findall(r'"qrc:(/[^"]+)"', value or '')
    light = [s for s in sources if 'light' in s] or sources
    return light[0] if light else None

def button(label):
    return f'JOY_BTN{int(label)}'

def collect(node, context, ox, oy, images, marks, texts):
    if not visible(node, context):
        return
    kind = node['type']
    x = ox + number(node, 'x', context)
    y = oy + number(node, 'y', context)
    props = node['props']
    if kind == 'Image' and (source := light_source(props.get('source'))):
        images.append({'source': source, 'x': x, 'y': y,
                       'w': number(node, 'width', context, None), 'h': number(node, 'height', context, None)})
    elif kind in ('ASGeneralKeys', 'ASSquareKeys') and 'labText' in props:
        marks.append({'input': button(props['labText'].strip('"')), 'x': x + LABEL / 2, 'y': y + LABEL / 2})
    elif kind == 'ASHouseShapeKeys' and 'labText' in props:
        marks.append({'input': button(props['labText'].strip('"')), 'x': x + LABEL / 2, 'y': y + 10})
    elif kind == 'ASOctagonalAxis':
        size = number(node, 'width', context, 90)
        cx, cy, radius = x + size / 2, y + size / 2, size / 2 - LABEL / 2
        labels = json.loads(props['btnNumList'])
        if labels[0] >= 0:
            marks.append({'input': button(labels[0]), 'x': cx, 'y': cy})
        for index, label in enumerate(labels[1:]):
            if label >= 0:
                angle = math.radians(index * 45)
                marks.append({'input': button(label), 'x': cx + radius * math.sin(angle), 'y': cy - radius * math.cos(angle)})
    elif kind == 'ASHelmetOfVisionSimple':
        size = number(node, 'width', context, 90)
        cx, cy, radius = x + size / 2, y + size / 2, size / 2 + LABEL / 2
        for index, direction in enumerate(POV_DIRECTIONS):
            angle = math.radians(index * 45)
            marks.append({'input': f'JOY_BTN_POV1_{direction}', 'x': cx + radius * math.sin(angle), 'y': cy - radius * math.cos(angle)})
    elif kind == 'Text' and (text := re.fullmatch(r'(?:qsTranslate\("",\s*)?"(\w+)"\)?', props.get('text', ''))):
        texts.append({'text': text.group(1), 'x': x, 'y': y})
    for child in node['children']:
        collect(child, context, x, y, images, marks, texts)

def png_size(blob):
    return struct.unpack('>II', blob[16:24])

def percent(value):
    return round(value * 100, 2)

def frame_from_view(view, sizes):
    width, height = view['width'], view['height']
    images = view['images']
    pictures = {image['file']: {'size': list(sizes[image['file']]), 'marks': []} for image in images}
    for mark in view['marks']:
        inside = [i for i in images if i['x'] <= mark['x'] <= i['x'] + i['w'] and i['y'] <= mark['y'] <= i['y'] + i['h']]
        owner = inside[-1] if inside else min(images, key=lambda i: abs(mark['x'] - (i['x'] + i['w'] / 2)) + abs(mark['y'] - (i['y'] + i['h'] / 2)))
        pictures[owner['file']]['marks'].append({'input': mark['input'],
                                                 'x': percent((mark['x'] - owner['x']) / owner['w']),
                                                 'y': percent((mark['y'] - owner['y']) / owner['h'])})
    if len(images) == 1 and (images[0]['x'], images[0]['y'], images[0]['w'], images[0]['h']) == (0, 0, width, height):
        return pictures, {'picture': images[0]['file']}
    layers = [{'picture': i['file'], 'at': [percent(i['x'] / width), percent(i['y'] / height), percent(i['w'] / width)]} for i in images]
    return pictures, {'size': [width, height], 'layers': layers}

def mh16(resources):
    qml = resources['/Page/Rocker/ASRockerPage.qml'].decode('utf-8')
    tree = parse_qml(qml)
    image = find(tree, lambda n: n['type'] == 'Image' and 'img_rocker_line.png' in n['props'].get('source', ''))
    width, height = png_size(resources['/Picture/img_rocker_line.png'])
    context = {'rocker_Img.width': width, 'rocker_Img.height': height, 'joystick_map.PovHatMode': 0, 'root.rocker_index': 0}
    images, marks, texts = [], [], []
    for child in image['children']:
        collect(child, context, 0, 0, images, marks, texts)
    view = {'width': width, 'height': height,
            'images': [{'file': 'mh16.png', 'x': 0, 'y': 0, 'w': width, 'h': height}],
            'marks': marks + MH16_AXES}
    files = {'mh16.png': resources['/Picture/img_rocker_line.png'],
             'card.png': resources['/Picture/joystatic/home_img_j00/home_img_j00@2x.png']}
    return 'MOZA/AB9 + MH16', {
        'name': 'MOZA AB9 FFB Base + MH16 grip',
        'role': 'stick',
        'dcsName': 'MOZA AB9 FFB Base',
        'axes': [{'input': 'JOY_X', 'label': 'Stick left / right'}, {'input': 'JOY_Y', 'label': 'Stick forward / back'}],
    }, view, files

def mtq_tqf(resources):
    qml = resources['/Page/Panel/ASPanelT01Page.qml'].decode('utf-8')
    tree = parse_qml(qml)
    holder = find(tree, lambda n: n['type'] == 'Item' and n['props'].get('width') == 'panelbtnPanel.refWidth'
                  and any(c['type'] == 'Image' for c in n['children']))
    ref = find(tree, lambda n: 'refWidth' in n['props'])
    width, height = int(float(ref['props']['refWidth'])), int(float(ref['props']['refHeight']))
    context = {'stickArea.leftRodType': 1, 'stickArea.rightRodType': 1, 'panel_t01_map.leftRodType': 1,
               'panel_t01_map.rightRodType': 1, 'stickArea.isDark': False}
    images, marks, texts = [], [], []
    for child in holder['children']:
        collect(child, context, 0, 0, images, marks, texts)
    files, view_images = {}, []
    for image in images:
        name = Path(image['source']).name.replace('@2x', '').replace('img_panel_t01_', '')
        files[name] = resources[image['source']]
        w, h = png_size(files[name])
        view_images.append({'file': name, 'x': image['x'], 'y': image['y'], 'w': image['w'] or w, 'h': image['h'] or h})
    axis_marks = [{'input': MTQ_AXES[t['text']], 'x': t['x'] + 8, 'y': t['y'] + 8} for t in texts if t['text'] in MTQ_AXES]
    view = {'width': width, 'height': height, 'images': view_images, 'marks': marks + axis_marks}
    files['card.png'] = resources['/Picture/panel/home_t01/home_img_tqf.png']
    return 'MOZA/MTQ + TQF', {
        'name': 'MOZA MTQ Throttle Panel + TQF grip',
        'role': 'throttle',
        'dcsName': 'MOZA AB9 FFB Base',
        'preset': None,
        'axes': [{'input': MTQ_AXES[k], 'label': k} for k in ('RX', 'RY', 'Slider', 'Dial', 'X', 'Y')],
        'unverified': ['axes'],
    }, view, files

def write_device(folder, device, view, files, sizes, card='card.png'):
    pictures, frame = frame_from_view(view, sizes)
    pictures[card] = pictures.get(card) or {'size': list(sizes[card]), 'marks': []}
    device = {**device, 'pictures': pictures, 'card': {'picture': card}, 'views': [{'name': 'Main', **frame}]}
    folder.mkdir(parents=True, exist_ok=True)
    (folder / 'device.json').write_text(json.dumps(device, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    for name, blob in files.items():
        (folder / name).write_bytes(blob)
    print(folder.relative_to(OUT), sum(len(p['marks']) for p in pictures.values()), 'marks,', len(pictures), 'pictures')

def main():
    parser = argparse.ArgumentParser(description='Build MOZA device pictures and button maps from a local MOZA Cockpit install.')
    parser.add_argument('--cockpit', default=str(DEFAULT_COCKPIT))
    args = parser.parse_args()
    resources = qt_resources(Path(args.cockpit) / 'bin' / 'MOZA Cockpit.exe')
    for build in (mh16, mtq_tqf):
        path, device, view, files = build(resources)
        write_device(OUT / path, device, view, files, {name: png_size(blob) for name, blob in files.items()})

if __name__ == '__main__':
    main()
