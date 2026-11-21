# obs-mtg-scanner

An OBS Browser Source overlay that identifies Magic: The Gathering cards held up to your webcam and shows an info panel with the card image, set, rarity, and current price.

Recognition runs entirely in the browser using a fork of [CollectorVision](https://github.com/HanClinto/CollectorVision)'s web scanner (ONNX Runtime Web + the Milo embedding catalog), kept in [`collectorvision/`](collectorvision/README.md). Card details and prices come from the [Scryfall API](https://scryfall.com/docs/api).

## Quick start

```bash
git clone https://github.com/jpinz/obs-mtg-scanner.git
cd obs-mtg-scanner
npm install
npm run dev        # http://localhost:5173
```

`npm run dev` and `npm run build` first run `npm run setup`. That copies the forked scanner sources from `collectorvision/` and downloads CollectorVision's prebuilt model/catalog bundle (~43 MB, cached in `.cache/`) into `public/collectorvision/`. Run `node scripts/fetch-collectorvision.mjs --force` to refresh it. Extraction needs a `tar` with zstd support (built into Windows 10+ and macOS).

For a production build, run `npm run build && npm run preview`.

## Adding it to OBS

1. **Enable camera access for browser sources.** Launch OBS with `--enable-media-stream`. For example, add it to the Target field of your OBS shortcut: `"C:\Program Files\obs-studio\bin\64bit\obs64.exe" --enable-media-stream`. Only use this flag if you trust every page you load in a browser source.
2. **Free the webcam.** The overlay opens the camera itself and renders the video, so remove or disable any *Video Capture Device* source that uses the same camera.
3. Add a **Browser Source**:
   - URL: `http://localhost:5173/?currency=usd&pos=bottom-right` (see the options below)
   - Width/Height: your canvas size, e.g. `1920` × `1080`
   - Leave *Shutdown source when not visible* off, so the models stay loaded.

The first load downloads the models and catalog. Later loads come from the browser cache.

## URL options

| Param | Values | Default | Description |
| --- | --- | --- | --- |
| `currency` | `usd`, `usd_foil`, `usd_etched`, `eur`, `eur_foil`, `tix` | `usd` | Price to show. Falls back to the other finish of the same currency when missing. |
| `pos` | `top-left`, `top-right`, `bottom-left`, `bottom-right` | `bottom-right` | Info panel corner |
| `image` | `1` / `0` | `1` | Show the card image |
| `set` | `1` / `0` | `1` | Show set, collector number, and rarity |
| `duration` | seconds | `8` | How long the panel stays after the card leaves the frame (`0` = until the next card) |
| `threshold` | `0`–`1` | `0.5` | Minimum match score |
| `catalog` | `v2`, `v1` | `v2` | `v2` follows CollectorVision's live, up-to-date catalog (same as the hosted demo; cached after first load). `v1` uses the bundled offline snapshot. |
| `camera` | device ID | default camera | Specific camera to use (`MediaDeviceInfo.deviceId`) |
| `res` | `WIDTHxHEIGHT` | `1280x720` | Requested camera resolution |
| `mirror` | `1` / `0` | `0` | Mirror the video (recognition always uses the unmirrored frame) |
| `theme` | `dark`, `light` | `dark` | Panel theme |
| `accent` | hex color | `f59e0b` | Panel accent color |
| `scale` | `0.25`–`4` | `1` | Panel size multiplier |
| `debug` | `1` / `0` | `0` | Show the detection outline, FPS, and scanner status |

## Development

```bash
npm test           # vitest
npm run typecheck
```

## License

AGPL-3.0, because this project bundles and serves CollectorVision, which is AGPL-3.0 licensed. Card data and images © Wizards of the Coast, provided via Scryfall.
