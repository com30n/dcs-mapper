# Adding aircraft, devices and translations

Everything the site shows lives in three folders:

```
aircraft/<module>/            one folder per DCS module
  aircraft.json               commands, categories, default bindings, ED presets
  l10n/<language>.json        command names in that language
devices/<maker>/<device>/     one folder per stick, throttle, pedals or panel
  device.json                 where each button is on the pictures
  *.png, *.jpg, *.webp, *.svg the pictures
locales/<language>.json       the site's own texts
```

You can add files without git: open the folder on GitHub, choose **Add file → Upload files**, drop
the files in, and let GitHub open the pull request for you. Every pull request is checked
automatically (`web/src/data/data.test.ts`); if the check fails, its log names the file and what is wrong.
If you would rather not touch the repository, open an issue with the **Add a device** or
**Add an aircraft** form and attach the files.

## Add an aircraft module

The commands of a module can only be read from the game, so this needs a PC with DCS World and
the module installed.

1. Download `hotas-mapper-export-module.exe` from the
   [Releases](../../releases) page and run it. It finds DCS by itself.
2. Type the numbers of the modules you want, or press Enter for all of them.
3. It writes `aircraft/<module>/` next to the exe: the commands in every language DCS ships.
4. Upload that folder into `aircraft/` of the repository.

Run it again after a DCS update that changes the controls. With Python installed you can run the
same tool from the repository instead: `python tools/extract_aircraft.py --only <module>`.

## Add a device

The easiest way is the [device editor](https://com30n.github.io/dcs-mapper/editor/): add a picture,
press each button on your device and click where it is, frame the card and the views, then download
the device folder as a `.zip` and drop it into `devices/<maker>/` on GitHub. **Try it in the mapper**
shows the device on the site before you send it. To fix the numbers of a device that is already in
the library, pick it in the editor instead of starting a new one.

The folder can also be written by hand: `devices/<maker>/<device>/`, for example
`devices/VIRPIL/MongoosT-50CM3/`, with the pictures and one `device.json`:

```json
{
 "name": "VIRPIL MongoosT-50CM3 base + grip",
 "role": "stick",
 "dcsName": "R-VPC Stick MT-50CM3",
 "pictures": {
  "grip.png": {
   "size": [2400, 1600],
   "marks": [
    {"input": "JOY_BTN1", "x": 41.2, "y": 63.0},
    {"input": "JOY_BTN_POV1_U", "x": 77.5, "y": 30.1}
   ]
  }
 },
 "card": {"picture": "grip.png", "x": 20, "y": 0, "w": 60, "h": 100},
 "views": [
  {"name": "Front", "picture": "grip.png", "x": 0, "y": 0, "w": 50, "h": 100},
  {"name": "Side", "picture": "grip.png", "x": 50, "y": 0, "w": 50, "h": 100}
 ],
 "axes": [
  {"input": "JOY_X", "label": "Stick left / right"},
  {"input": "JOY_Y", "label": "Stick forward / back"}
 ]
}
```

- `dcsName` is the device name exactly as the DCS Controls screen shows it, without the `{…}` part.
- `role` is one of `stick`, `throttle`, `pedals`, `panel`, `other`.
- **Pictures.** Each picture lists its `size` in pixels and its `marks`. A mark puts a number on a
  button: `input` is the DCS name (`JOY_BTN1`…, `JOY_BTN_POV1_U`/`UR`/`R`/`DR`/`D`/`DL`/`L`/`UL`,
  `JOY_X`, `JOY_Y`, `JOY_Z`, `JOY_RX`, `JOY_RY`, `JOY_RZ`, `JOY_SLIDER1`, `JOY_SLIDER2`) and `x`, `y`
  are the centre of the number **in percent of the picture**, so they stay right at any resolution.
  Use the numbering of the maker's software or of the DCS Controls screen.
- **Card and views are windows onto the pictures.** `x`, `y`, `w`, `h` are again percent of the
  picture; leave them out to show the whole picture. The `card` is the picture in the device
  library. The `views` are what the binding screen shows, one or more, for example front and side
  of a grip. A button appears in every view whose window contains it.
- **A view can be put together from several pictures**, for example a throttle panel and its grip
  from separate files:

  ```json
  {"name": "Main", "size": [1600, 900], "layers": [
    {"picture": "panel.png", "at": [5, 10, 40]},
    {"picture": "grip.png", "x": 0, "y": 0, "w": 50, "h": 100, "at": [55, 5, 40]}
  ]}
  ```

  `size` gives the shape of the view; each layer shows a window of a picture (`x`, `y`, `w`, `h`)
  placed at `at`: `[left, top, width]` in percent of the view, the height following the picture.
- Pictures are `.png`, `.jpg`, `.webp` or `.svg`, at most 3 MB each. A line drawing on a white or
  transparent background reads best. Only submit pictures you made yourself or are allowed to share.

## Translate

- **The site's texts:** copy `locales/en.json` to `locales/<code>.json` (for example `uk.json`),
  set `"language.name"` (the language as its speakers write it) and `"language.label"` (two or three
  letters for the switch), and translate the rest. The site offers the new language by itself.
- **Command names of a module:** every language DCS ships comes from the export tool. For another
  language, run it with `--new-language <code>` (from a command prompt:
  `hotas-mapper-export-module.exe --only <module> --new-language uk`). It writes
  `aircraft/<module>/l10n/<code>.json` with every name and an empty translation next to it; fill
  them in. Names left empty are shown in English.

## Check your files locally

Needs Node.js 22:

```
npm --prefix web ci
npm --prefix web test
npm --prefix web run dev
```

Then open http://localhost:5173. With Docker instead: `docker compose up --build`, then
http://localhost:8080.
