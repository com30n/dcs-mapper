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

def test_every_input_of_the_ed_warthog_presets_is_on_its_pictures():
    for template, folder in (('Joystick - HOTAS Warthog', 'Thrustmaster/HOTAS Warthog Joystick'),
                             ('Throttle - HOTAS Warthog', 'Thrustmaster/HOTAS Warthog Throttle')):
        used = set()
        for path in (REPO / 'aircraft').glob('*/aircraft.json'):
            preset = json.loads(path.read_text(encoding='utf-8'))['presets'].get(template) or {}
            for section in ('keyDiffs', 'axisDiffs'):
                for entry in preset.get(section, {}).values():
                    for combo in entry.get('added', []) + entry.get('changed', []):
                        used.add(combo['key'])
                        used.update(combo.get('reformers', []))
        drawn = {m['input'] for m in marks(folder)}
        assert len(used) >= 20 and used <= drawn, (template, sorted(used - drawn))

def test_mh16_picture_shows_moza_numbering():
    drawn = marks('MOZA/AB9 + MH16')
    inputs = {m['input'] for m in drawn}
    assert inputs == {f'JOY_BTN{n}' for n in range(1, 27)} | {f'JOY_BTN_POV1_{d}' for d in moza.POV_DIRECTIONS} | {'JOY_X', 'JOY_Y'}
    trigger = next(m for m in drawn if m['input'] == 'JOY_BTN1')
    assert (trigger['x'], trigger['y']) == (14.99, 50.17)

def test_site_default_axis_filter_has_the_fields_dcs_writes():
    root = dcs_root()
    if not root:
        return 'skipped: no DCS install'
    data = (root / 'Scripts' / 'Input' / 'Data.lua').read_text(errors='ignore')
    body = re.search(r'createAxisFilter\s*=\s*function.*?return result', data, re.S).group(0)
    dcs = set(re.findall(r'result\.(\w+)\s*=', body))
    site = (REPO / 'web' / 'src' / 'dcs' / 'axis.ts').read_text(encoding='utf-8')
    default = re.search(r'DEFAULT_FILTER\b[^=]*=\s*\{([^}]*)\}', site).group(1)
    assert set(re.findall(r'(\w+):', default)) == dcs, sorted(dcs)

def test_dcs_install_is_read_from_the_log_with_or_without_quotes():
    plain = r'INFO    APP (Main): Command line: D:\DCS World\bin\DCS.exe --no-launcher'
    quoted = r'INFO    APP (Main): Command line: "H:\[steam]\steamapps\common\DCSWorld\bin\DCS.exe" --force_enable_VR'
    assert aircraft.dcs_root_in(plain) == Path('D:/DCS World')
    assert aircraft.dcs_root_in(quoted) == Path('H:/[steam]/steamapps/common/DCSWorld')

def test_translations_keep_the_text_dcs_writes_verbatim():
    catalogs = [{'Autopilot override': 'Автопилот, временное отключение ', 'Blank': ' '}]
    assert aircraft.translate(catalogs, 'Autopilot override') == 'Автопилот, временное отключение '
    assert aircraft.translate(catalogs, 'Blank') == 'Blank'

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

def site_axis_roles():
    site = (REPO / 'web' / 'src' / 'state' / 'devices.ts').read_text(encoding='utf-8')
    return set(re.findall(r'(\w+):', re.search(r'AXIS_ROLES\b[^=]*=\s*\{([^}]*)\}', site).group(1)))

def test_site_tells_devices_apart_by_every_axis_the_dcs_wizard_asks_for():
    root = dcs_root()
    if not root:
        return 'skipped: no DCS install'
    page = (root / 'Scripts' / 'Input' / 'WizardAxisPage.lua').read_text(errors='ignore')
    asked = set(re.findall(r"name = '(\w+)'.*isAxis = true", page))
    assert asked == {'pitch', 'roll', 'rudder', 'thrust'}, asked
    assert asked <= site_axis_roles()

def test_site_axis_roles_are_names_dcs_assigns():
    root = dcs_root()
    if not root:
        return 'skipped: no DCS install'
    table = (root / 'Scripts' / 'Input' / 'DefaultAssignments.lua').read_text(errors='ignore')
    assert site_axis_roles() <= set(re.findall(r'^\s+(\w+)\s*=', table, re.M))

def test_axis_assignments_are_what_the_huey_declares():
    root = dcs_root()
    if not root:
        return 'skipped: no DCS install'
    lua = (root / 'Mods' / 'aircraft' / 'Uh-1H' / 'Input' / 'UH-1H' / 'joystick' / 'default.lua').read_text(errors='ignore')
    declared = {name: assignment for assignment, name in re.findall(r'defaultDeviceAssignmentFor\("(\w+)"\)\s*,\s*action\s*=\s*\w+\s*,\s*name\s*=\s*_\(\'([^\']+)\'\)', lua)}
    assert len(declared) >= 4, declared
    extracted = {c['name']: c['assignment'] for c in catalogue('UH-1H')['commands']['axis'] if 'assignment' in c}
    assert extracted == declared, (extracted, declared)

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
