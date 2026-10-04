import argparse
import gettext
import json
import os
import re
import struct
import subprocess
import sys
import tempfile
from functools import cache
from pathlib import Path

FROZEN = getattr(sys, 'frozen', False)
HERE = Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parent))
REPO = Path(__file__).resolve().parent.parent
DEFAULT_OUT = Path.cwd() / 'aircraft' if FROZEN else REPO / 'aircraft'
SAVED = Path(os.environ.get('USERPROFILE', '~')).expanduser() / 'Saved Games' / 'DCS'
IDENTIFIER = re.compile(rb'[A-Za-z_][A-Za-z0-9_]*')
UI_LAYER = 'UiLayer'
DCS_LANGUAGE_CODES = {'cn': 'zh', 'jp': 'ja'}

def find_dcs_root(explicit=None):
    if explicit:
        return Path(explicit)
    log = (SAVED / 'Logs' / 'dcs.log').read_text(errors='ignore')
    return Path(re.search(r'Command line: (.+?)\\bin(?:-mt)?\\DCS\.exe', log).group(1))

def read_actions(dll):
    data = dll.read_bytes()
    pe = struct.unpack_from('<I', data, 0x3c)[0]
    section_count = struct.unpack_from('<H', data, pe + 6)[0]
    optional_size = struct.unpack_from('<H', data, pe + 20)[0]
    image_base = struct.unpack_from('<Q', data, pe + 48)[0]
    sections = [struct.unpack_from('<IIII', data, pe + 24 + optional_size + 40 * i + 8) for i in range(section_count)]

    def offset_to_va(offset):
        for _, va, raw_size, raw in sections:
            if raw <= offset < raw + raw_size:
                return image_base + va + offset - raw

    def name_at(va):
        rva = va - image_base
        for _, section_va, raw_size, raw in sections:
            if section_va <= rva < section_va + raw_size:
                start = raw + rva - section_va
                end = data.find(b'\0', start, start + 128)
                text = data[start:end]
                return text.decode() if end > start and IDENTIFIER.fullmatch(text) else None

    entry = data.index(struct.pack('<Q', offset_to_va(data.index(b'iCommandNull\0'))))
    actions = {}
    while name := name_at(struct.unpack_from('<Q', data, entry)[0]):
        actions[name] = struct.unpack_from('<i', data, entry - 8)[0]
        entry += 16
    return actions

def to_lua(value):
    if isinstance(value, bool):
        return 'true' if value else 'false'
    if isinstance(value, (int, float)):
        return repr(value)
    if isinstance(value, str):
        return '"' + value.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n') + '"'
    items = enumerate(value, 1) if isinstance(value, list) else sorted(value.items())
    return '{' + ','.join(f'[{to_lua(k)}]={to_lua(v)}' for k, v in items) + '}'

class Dcs:
    def __init__(self, root):
        self.root = Path(root)

    @cache
    def actions_file(self):
        path = Path(tempfile.gettempdir()) / 'dcs_hotas_mapper_actions.lua'
        path.write_text('return ' + to_lua(read_actions(self.root / 'bin' / 'Input.dll')))
        return str(path)

    def lua(self, *args):
        run = subprocess.run([str(self.root / 'bin' / 'luae.exe'), str(HERE / 'catalog.lua'), *args],
                             cwd=self.root, capture_output=True)
        if run.returncode or not run.stdout.strip():
            raise RuntimeError(run.stderr.decode(errors='replace') or f'lua produced no output for {args[:3]}')
        return json.loads(run.stdout)

    @cache
    def aircraft(self):
        entries = [str(p) for base in (self.root / 'Mods' / 'aircraft', self.root / 'CoreMods' / 'aircraft', SAVED / 'Mods' / 'aircraft')
                   for p in base.glob('*/entry.lua')]
        found = self.lua('entries', *entries)
        found[UI_LAYER] = str(self.root / 'Config' / 'Input' / 'UiLayer')
        return {name: folder for name, folder in sorted(found.items()) if (Path(folder) / 'joystick' / 'default.lua').exists()}

    def templates(self, profile):
        joystick = Path(self.aircraft()[profile]) / 'joystick'
        names = {p.name.removesuffix('.diff.lua') for p in joystick.glob('*.diff.lua')}
        names |= {p.stem for p in joystick.glob('*.lua') if not p.name.endswith('.diff.lua') and p.stem != 'default'}
        return sorted(names)

    def catalog(self, profile):
        return self.lua('catalog', self.actions_file(), self.aircraft()[profile], *self.templates(profile))

    def applied(self, profile):
        return self.lua('applied', self.actions_file(), self.aircraft()[profile], *self.templates(profile))

def categories(value):
    if isinstance(value, str):
        return [value]
    return list(value) if isinstance(value, list) else []

def clean_combo(combo):
    clean = {'key': combo['key']}
    if combo.get('reformers'):
        clean['reformers'] = list(combo['reformers'])
    if combo.get('filter'):
        clean['filter'] = combo['filter']
    return clean

def commands_of(device):
    result = {}
    for kind in ('key', 'axis'):
        merged = {}
        for command in device[kind]:
            merged.setdefault(command['hash'], {'hash': command['hash'], 'name': command['name'], 'category': categories(command.get('category'))})
        result[kind] = list(merged.values())
    return result

def screen_commands(raw, joystick_device):
    joystick = commands_of(joystick_device)
    result = {}
    for kind in ('key', 'axis'):
        bindable = {c['hash'] for c in joystick[kind]}
        merged = {}
        for device in (raw.get('keyboard') or {kind: []}, joystick_device, raw.get('mouse') or {kind: []}):
            for command in commands_of(device)[kind]:
                if command['hash'] not in merged:
                    merged[command['hash']] = command if command['hash'] in bindable else {**command, 'joystick': False}
        result[kind] = list(merged.values())
    assignments = raw.get('assignments') or {}
    for command in result['axis']:
        if command['hash'] in assignments:
            command['assignment'] = assignments[command['hash']]
    return result

def defaults_of(device):
    result = {}
    for kind in ('key', 'axis'):
        result[kind] = {}
        for command in device[kind]:
            combos = [clean_combo(c) for c in command.get('combos') or []]
            if combos:
                result[kind].setdefault(command['hash'], [])
                result[kind][command['hash']] += [c for c in combos if c not in result[kind][command['hash']]]
    return result

def clean_diff(diff):
    result = {}
    for section in ('keyDiffs', 'axisDiffs'):
        entries = {}
        for hash_, entry in (diff.get(section) or {}).items():
            kept = {k: [clean_combo(c) for c in entry[k]] for k in ('added', 'removed', 'changed') if entry.get(k)}
            if kept:
                entries[hash_] = kept
        result[section] = entries
    return result

def force_feedback_of(device):
    ff = device.get('forceFeedback')
    if ff is None:
        return None
    defaults = {'trimmer': 1.0, 'shake': 0.5, 'swapAxes': False, 'invertX': False, 'invertY': False, 'ignore': False}
    return {k: v if ff.get(k) is None else ff[k] for k, v in defaults.items()}

def folder_name(profile):
    return re.sub(r'[*/?<>|\\:"]', '', profile)

def build(dcs, profile):
    raw = dcs.catalog(profile)
    generic = raw['devices']['']
    commands = screen_commands(raw, generic)
    joystick_hashes = lambda device: {k: {c['hash'] for c in commands_of(device)[k]} for k in ('key', 'axis')}
    hashes = joystick_hashes(generic)
    defaults = {'': defaults_of(generic)}
    force_feedback = {'': force_feedback_of(generic)}
    profiles = {}
    for template, device in sorted(raw['devices'].items()):
        if not template:
            continue
        if force_feedback_of(device) != force_feedback['']:
            force_feedback[template] = force_feedback_of(device)
        if joystick_hashes(device) != hashes:
            profiles[template] = {'commands': screen_commands(raw, device), 'defaults': defaults_of(device)}
        elif (device_defaults := defaults_of(device)) != defaults['']:
            defaults[template] = device_defaults
    return {
        'id': profile,
        'folder': folder_name(profile),
        'name': raw.get('name') or profile,
        'commands': commands,
        'defaults': defaults,
        'profiles': profiles,
        'presets': {t: clean_diff(d) for t, d in sorted(raw['presets'].items())},
        'forceFeedback': force_feedback,
    }

def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':'), sort_keys=True), encoding='utf-8')

def dcs_translations(root):
    result = {}
    for folder in sorted((root / 'l10n').glob('*/LC_MESSAGES')):
        code = DCS_LANGUAGE_CODES.get(folder.parent.name, folder.parent.name)
        if code == 'en' or not (folder / 'input.mo').exists():
            continue
        catalogs = []
        for domain in ('dcs', 'input'):
            if (folder / f'{domain}.mo').exists():
                with (folder / f'{domain}.mo').open('rb') as handle:
                    catalogs.append(gettext.GNUTranslations(handle)._catalog)
        result[code] = catalogs
    return result

def translate(catalogs, text):
    for catalog in catalogs:
        value = catalog.get(text)
        if isinstance(value, str) and value.strip():
            return value
    return text

def texts_of(catalogue):
    texts = {catalogue['name'], 'Axis Commands'}
    for kind in ('key', 'axis'):
        for command in catalogue['commands'][kind]:
            texts.add(command['name'])
            texts.update(command['category'])
    return sorted(texts)

def write_translations(folder, translations, catalogue):
    for code, catalogs in translations.items():
        words = {text: translate(catalogs, text) for text in texts_of(catalogue)}
        write_json(folder / 'l10n' / f'{code}.json', {k: v for k, v in words.items() if v != k})

def write_language_template(folder, catalogue, code):
    file = folder / 'l10n' / f'{code}.json'
    if not file.exists():
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(json.dumps({text: '' for text in texts_of(catalogue)}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        print(f'  {file}: fill in the empty translations')

def choose(profiles):
    for number, profile in enumerate(profiles, 1):
        print(f'{number:3}. {profile}')
    answer = input('Numbers of the modules to export (e.g. 3 7), or Enter for all: ').split()
    return [profiles[int(n) - 1] for n in answer if n.isdigit() and 0 < int(n) <= len(profiles)] or profiles

def main():
    parser = argparse.ArgumentParser(description='Build the aircraft command catalogue from a local DCS World install.')
    parser.add_argument('--dcs', help='DCS World install folder; found from dcs.log when omitted')
    parser.add_argument('--only', nargs='+', metavar='PROFILE', help='export only these input profiles, e.g. F-16C_50')
    parser.add_argument('--list', action='store_true', help='list the input profiles found and exit')
    parser.add_argument('--fixture', help='also write the preset round-trip fixture for this profile')
    parser.add_argument('--out', default=str(DEFAULT_OUT), help='folder to write <module>/ into (default: %(default)s)')
    parser.add_argument('--new-language', metavar='CODE', help='also write l10n/CODE.json with empty translations to fill in')
    args = parser.parse_args()
    dcs = Dcs(find_dcs_root(args.dcs))
    profiles = dcs.aircraft()
    if args.list:
        print(*profiles, sep='\n')
        return
    unknown = set(args.only or []) - set(profiles)
    if unknown:
        raise SystemExit(f'not installed: {", ".join(sorted(unknown))}; see --list')
    asked = FROZEN and len(sys.argv) == 1
    wanted = args.only or (choose(profiles) if asked else profiles)
    out = Path(args.out)
    translations = dcs_translations(dcs.root)
    for profile in profiles:
        if profile not in wanted and profile != UI_LAYER:
            continue
        catalogue = build(dcs, profile)
        folder = out / catalogue['folder']
        write_json(folder / 'aircraft.json', catalogue)
        write_translations(folder, translations, catalogue)
        if args.new_language:
            write_language_template(folder, catalogue, args.new_language)
        print(f'{profile}: {len(catalogue["commands"]["key"])} key, {len(catalogue["commands"]["axis"])} axis, '
              f'{len(catalogue["presets"])} presets, {len(catalogue["profiles"])} own device profiles -> {folder}')
    if args.fixture:
        write_json(REPO / 'test' / 'fixtures' / f'applied-{folder_name(args.fixture)}.json', dcs.applied(args.fixture))
    if asked:
        input(f'Done. Upload the folders from {out} into the aircraft/ folder of the repository. Press Enter to close.')

if __name__ == '__main__':
    main()
