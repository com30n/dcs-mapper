import json
import re
import sys
from pathlib import Path

import extract_aircraft as aircraft
import extract_moza as moza

REPO = aircraft.REPO

def dcs_root():
    try:
        return aircraft.find_dcs_root()
    except (OSError, AttributeError):
        return None

def catalogue(profile):
    return json.loads((REPO / 'aircraft' / profile / 'aircraft.json').read_text(encoding='utf-8'))

def marks(device_id):
    device = json.loads((REPO / 'devices' / device_id / 'device.json').read_text(encoding='utf-8'))
    return [m for picture in device['pictures'].values() for m in picture['marks']]

def test_actions_match_values_named_in_dcs_sources():
    root = dcs_root()
    if not root:
        return 'skipped: no DCS install'
    actions = aircraft.read_actions(root / 'bin' / 'Input.dll')
    loader = (root / 'Scripts' / 'Input' / 'Loader.lua').read_text(errors='ignore')
    template = (root / 'API' / 'ExternalFMTemplate' / 'ED_FM_Template' / 'ED_FM_Template.cpp').read_text(errors='ignore')
    named = re.findall(r'(?:down|pressed)\s*=\s*(\d+).*--\s*(iCommand\w+)', loader)
    named += re.findall(r'command == (\d+)\)\s*//\s*(iCommand\w+)', template)
    assert len(named) >= 8, named
    for value, name in named:
        assert actions[name] == int(value), (name, actions.get(name), value)

def test_catalogue_hashes_cover_presets_shipped_by_eagle_dynamics():
    shipped, missing = 0, []
    for folder in sorted(p.name for p in (REPO / 'aircraft').iterdir() if p.name != aircraft.UI_LAYER):
        data = catalogue(folder)
        known = {c['hash'] for kind in ('key', 'axis') for c in data['commands'][kind]}
        for preset in data['presets'].values():
            for section in ('keyDiffs', 'axisDiffs'):
                shipped += len(preset[section])
                missing += [h for h in preset[section] if h not in known]
    assert shipped > 300, shipped
    assert len(missing) <= shipped * 0.03, (shipped, len(missing), missing[:10])

def test_f16_default_axes_are_the_dcs_defaults():
    defaults = catalogue('F-16C_50')['defaults']['']['axis']
    assert defaults['a2001cdnil'] == [{'key': 'JOY_Y'}]
    assert defaults['a2002cdnil'] == [{'key': 'JOY_X'}]
    assert defaults['a2003cdnil'] == [{'key': 'JOY_RZ'}]
    assert defaults['a2004cdnil'] == [{'key': 'JOY_Z'}]

def test_every_button_of_the_ed_moza_preset_is_on_the_mh16_picture():
    preset = catalogue('F-16C_50')['presets']['MOZA AB9 FFB Base']
    used = {c['key'] for entry in preset['keyDiffs'].values() for c in entry.get('added', [])}
    drawn = {m['input'] for m in marks('MOZA/AB9 + MH16')}
    assert len(used) >= 20, used
    assert used <= drawn, sorted(used - drawn)

def test_mh16_picture_shows_moza_numbering():
    drawn = marks('MOZA/AB9 + MH16')
    inputs = {m['input'] for m in drawn}
    assert inputs == {f'JOY_BTN{n}' for n in range(1, 27)} | {f'JOY_BTN_POV1_{d}' for d in moza.POV_DIRECTIONS} | {'JOY_X', 'JOY_Y'}
    trigger = next(m for m in drawn if m['input'] == 'JOY_BTN1')
    assert (trigger['x'], trigger['y']) == (14.99, 50.17)

def test_qml_parser_keeps_inline_elements_and_evaluates_ternaries():
    tree = moza.parse_qml('''Item {
        delegate: Item {
            ASGeneralKeys {
                x: rocker_Img.width*160/1141
                visible: mode === 1 ? true : false
                labText: "7"
            }
        }
    }''')
    keys = moza.find(tree, lambda n: n['type'] == 'ASGeneralKeys')
    assert keys is not None
    assert moza.number(keys, 'x', {'rocker_Img.width': 1141}) == 160
    assert moza.visible(keys, {'mode': 1}) is True
    assert moza.visible(keys, {'mode': 0}) is False

if __name__ == '__main__':
    failed = 0
    for name, test in list(globals().items()):
        if name.startswith('test_'):
            try:
                result = test()
                print('ok  ', name, f'({result})' if result else '')
            except AssertionError as error:
                failed += 1
                print('FAIL', name, error)
    sys.exit(1 if failed else 0)
