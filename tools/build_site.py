import argparse
import functools
import http.server
import json
import shutil
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DATA = ('aircraft', 'devices', 'locales')
UI_LAYER = 'UiLayer'

def read(path):
    return json.loads(path.read_text(encoding='utf-8'))

def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

def card_pictures(device):
    card = device.get('card') or {}
    names = [layer['picture'] for layer in card.get('layers', [])] or [card.get('picture')]
    return {name: {'size': device['pictures'][name]['size']} for name in names if name}

def devices_index(root):
    result = []
    for file in sorted(root.glob('devices/*/*/device.json')):
        device = read(file)
        result.append({'id': f'{file.parent.parent.name}/{file.parent.name}', 'vendor': file.parent.parent.name,
                       'name': device['name'], 'role': device['role'], 'dcsName': device['dcsName'],
                       'card': device.get('card'), 'pictures': card_pictures(device)})
    return result

def aircraft_index(root):
    result = []
    for file in sorted(root.glob('aircraft/*/aircraft.json')):
        if file.parent.name == UI_LAYER:
            continue
        catalogue = read(file)
        result.append({'id': catalogue['id'], 'folder': file.parent.name, 'name': catalogue['name'],
                       'commands': len(catalogue['commands']['key']) + len(catalogue['commands']['axis']),
                       'presets': sorted(catalogue['presets'])})
    return result

def locales_index(root):
    return [{'code': file.stem, 'label': words['language.label'], 'name': words['language.name']}
            for file in sorted(root.glob('locales/*.json')) if file.stem != 'index' and (words := read(file))]

def build(out):
    shutil.rmtree(out, ignore_errors=True)
    if (REPO / 'web' / 'dist').is_dir():
        shutil.copytree(REPO / 'web' / 'dist', out)
    for folder in DATA:
        shutil.copytree(REPO / folder, out / folder)
    write(out / 'devices' / 'index.json', devices_index(REPO))
    write(out / 'aircraft' / 'index.json', aircraft_index(REPO))
    write(out / 'locales' / 'index.json', locales_index(REPO))
    return out

def main():
    parser = argparse.ArgumentParser(description='Assemble the site (web/dist, built with npm --prefix web run build) with its aircraft, devices and translations into one folder.')
    parser.add_argument('--out', default=str(REPO / 'build'), help='output folder (default: build/)')
    parser.add_argument('--serve', type=int, metavar='PORT', help='serve the result on this port after building')
    args = parser.parse_args()
    out = build(Path(args.out))
    print(f'{len(aircraft_index(REPO))} aircraft, {len(devices_index(REPO))} devices, {len(locales_index(REPO))} languages -> {out}')
    if args.serve:
        handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(out))
        print(f'http://localhost:{args.serve}')
        http.server.ThreadingHTTPServer(('', args.serve), handler).serve_forever()

if __name__ == '__main__':
    main()
