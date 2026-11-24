# obs-mtg-scanner

A web app that identifies Magic: The Gathering cards held up to your webcam and shows an info panel with the card image, set, rarity, and current price. It also gives you an overlay URL to add to OBS as a Browser Source.

Recognition runs entirely in your browser using a fork of [CollectorVision](https://github.com/HanClinto/CollectorVision)'s web scanner (ONNX Runtime Web + the Milo embedding catalog), kept in [`collectorvision/`](collectorvision/README.md). Webcam video never leaves the browser. Card details and tracking coordinates go directly from the scanner page to OBS over its local WebSocket; they are not sent to Vercel. Card details and prices come from the [Scryfall API](https://scryfall.com/docs/api). The app is deployed on [Vercel](https://vercel.com).

## Using the scanner and OBS

1. Open the app in a regular desktop browser (Chrome, Edge, or Firefox).
2. Choose a webcam and start scanning. The first load downloads the models and live catalog; later loads reuse the browser cache. An internet connection is needed to check the live catalog feed.
3. In OBS, enable the WebSocket server in **Tools → WebSocket Server Settings**. Keep the default port (`4455`) or enter your chosen port and password in the app.
4. Use **Copy URL** under *OBS Browser Source*, then add an OBS **Browser Source** with that URL. Size and position it to match the camera feed so the card panel follows the detected card.
5. Keep the scanner tab open while streaming. OBS and the scanner communicate directly on `localhost`; no card state is relayed through Vercel. OBS doesn't need camera permissions or the `--enable-media-stream` flag.

The app also previews the same overlay over its camera feed. If another app (including an OBS *Video Capture Device* source) is already using the webcam, select **OBS Virtual Camera** in the app or release the camera in the other app.

The **History** tab records each successfully identified printing and lets you add a printing by card name, replace an entry with another printing, or remove it. History is saved in this browser; repeated detections of the same card while its panel remains active count once. The total overlay sums the selected price for each entry, using the same finish fallback as the card panel. It excludes entries without a price and marks them as unpriced; prices are saved at lookup time and are not refreshed automatically. Change the price setting to switch currency or finish. Turn off **Show total value** or use **Edit layout** to move and resize the total.

Enable **Celebrate valuable cards** and enter a threshold to fire side confetti when a newly detected card's selected price meets or exceeds it. This uses the same currency and finish fallback as the card panel; unpriced cards do not trigger it. Holding the same card in frame does not repeat the celebration, and reconnecting OBS does not replay one. Both the preview and OBS celebrate; reduced-motion mode uses a brief, stationary edge sparkle instead of flying confetti. **Test celebration** previews the effect without adding to history.

The bundled [tada fanfare](public/audio/tada_fanfare.mp3) plays by default; select **Party horn** for the [other included sound](public/audio/birthday_party_horn.mp3). You can mute the sound or upload an MP3/WAV up to 256 KB. A custom sound stays in this browser's storage and is sent directly to local OBS only when a celebration fires. Uploading it selects it automatically; switch between it and the included sounds, or use **Remove custom sound** to delete it. Browser autoplay rules may require pressing **Test celebration**, or using OBS's **Interact** window to enable celebration sound. Configure the Browser Source's audio monitoring in OBS if you want to hear OBS audio locally; both views play sound, so avoid monitoring both into the stream.

Sound credits: [Tada Fanfare A](https://pixabay.com/sound-effects/musical-tada-fanfare-a-6313/) by plasterbrain (Freesound) and [Birthday Party Horn](https://pixabay.com/sound-effects/film-special-effects-birthday-party-horn-250238/) by Universfield, via Pixabay.

To exclude part of the camera image from recognition, start the camera and select **Ignore zones**. Click at least three points around an area, then select **Save zone**. Add multiple zones or remove them individually; **Undo point** removes the last point of the current draft. Keyboard users can focus the video, move the cursor with the arrow keys (Shift for larger steps), and press Enter to add points. Zones are saved with scanner settings and apply to any selected camera; check them after changing cameras. They follow the video when mirroring or changing resolution and are not shown in OBS. The scanner masks the areas before recognition and rejects detections that overlap them.

When a WebSocket password is set, **Copy URL** includes it in the URL fragment (`#obsPassword=…`) so the Browser Source logs in automatically; the URL shown in the app masks it. Copy the URL again after changing the password. A fragment password takes precedence over a password saved in the Browser Source's browser profile and is not saved automatically. If the URL has no password and OBS requires one, use the Browser Source's **Interact** window to enter it. Fragments are not sent in the HTTP request to Vercel, but the password remains visible in OBS source settings; treat the copied URL as a secret.

The default port is omitted from the URL; changing to a custom port requires copying the updated URL into OBS. The scanner must remain open while streaming.

## URL options

| Param | Values | Default | Description |
| --- | --- | --- | --- |
| `currency` | `usd`, `usd_foil`, `usd_etched`, `eur`, `eur_foil`, `tix` | `usd` | Price to show. Falls back to the other finish of the same currency when missing. |
| `finishes` | `1` / `0` | `0` | Show every available finish price for the identified printing in the selected currency (USD nonfoil, foil, and etched; EUR nonfoil and foil). MTGO has one price. Other printings, such as alternate-art cards with a different collector number, have separate prices and are not included. |
| `celebrate` | `1` / `0` | `0` | Celebrate newly detected cards meeting the price threshold |
| `celebrateAt` | nonnegative amount | `20` | Celebration threshold in the selected currency and finish, with the panel's finish fallback |
| `celebrateSound` | `1` / `0` | `1` | Play celebration audio; custom MP3/WAV uploads are saved separately in this browser |
| `image` | `1` / `0` | `1` | Show the pinned card image |
| `name` | `1` / `0` | `1` | Show the pinned card name |
| `info` | `1` / `0` | `1` | Show the pinned card details |
| `total` | `1` / `0` | `1` | Show the total value of history entries |
| `tpos` | `x,y,width,height` fractions `0`–`1` | `0.02,0.05,0.18,0.09` | Box of the pinned total value |
| `details` | comma-separated `set`, `number`, `rarity`, `price`, or `none` | all | Fields shown in the pinned details |
| `ipos`, `npos`, `dpos` | `x,y,width,height` fractions `0`–`1` | `0.8,0.06,0.1563,0.3871`, `0.8,0.47,0.18,0.05`, `0.8,0.53,0.18,0.2` | Box of the pinned image, name, and details. Drag them in the app preview to move them, or drag their edges and corners to resize. Text wraps inside the box; the image keeps its card proportions. |
| `ts` | `8`–`96` | `16` | Base text size in canvas pixels for all overlay text |
| `nts` | `8`–`96` | inherits (1.25 × `ts`) | Card name size in the pinned name |
| `dts` | `8`–`96` | inherits `ts` | Base text size of the pinned details |
| `dsz` | comma-separated `field:size`, e.g. `set:14,price:24` | inherits | Text size of individual detail lines |
| `fts` | `8`–`96` | inherits `ts` | Base text size of the follow panel |
| `follow` | `1` / `0` | `0` | Show a compact panel beside the tracked card |
| `sides` | comma-separated `top`, `bottom`, `left`, `right`, or `none` | `top,bottom` | Sides of the card the follow panel may use; it picks the allowed side with the most room |
| `duration` | seconds | `8` | How long the panel stays after the card leaves the frame (`0` = until the next card) |
| `threshold` | `0`–`1` | `0.5` | Minimum match score |
| `setcode` | comma-separated set codes, e.g. `woe,mom` | all sets | Restrict recognition candidates to cards from any listed set. Case-insensitive; the parameter may also be repeated. |
| `query` | Scryfall search syntax | no query filter | Restrict recognition candidates to cards matching a Scryfall query. May be combined with `setcode`. |
| `camera` | device ID | default camera | Specific camera to use (`MediaDeviceInfo.deviceId`) |
| `res` | `WIDTHxHEIGHT` | `1280x720` | Requested camera resolution |
| `mirror` | `1` / `0` | `0` | Mirror the video (recognition always uses the unmirrored frame) |
| `ignore` | JSON array of polygons | none | Ignore zones as arrays of `[x,y]` vertices in unmirrored frame fractions (`0`–`1`); normally configured in the camera preview. |
| `theme` | `dark`, `light` | `dark` | Panel theme |
| `accent` | hex color | `f59e0b` | Panel accent color |
| `debug` | `1` / `0` | `0` | Show the detection outline, FPS, and scanner status |

Older `scale` and `iw` options are still read: `scale` becomes `ts` (16 × scale) and `iw` sets the picture box size.

The scanner always uses CollectorVision's live v2 catalog. Older `catalog` URL options are ignored, including `catalog=v1`.

The scanner app's URL accepts these options. For example, adding `?setcode=woe,mom` restricts recognition to Wilds of Eldraine and March of the Machine. `?setcode=woe&setcode=mom` is equivalent. The app loads the sets' card IDs from Scryfall before starting the scanner; if no matching cards are in the catalog, it shows an error rather than scanning all sets. Omit `setcode` or leave it empty to scan all sets. The `details` option only controls which card details are shown in the overlay. Overlay display settings are sent to the Browser Source through the local OBS WebSocket; they are not encoded in its URL.

## Deploying to Vercel

The app is a static Vite build. Vercel serves the app and overlay pages; the live scanner data travels only over the local OBS WebSocket.

1. Import the repository into Vercel. [`vercel.json`](vercel.json) sets the build command, output directory, `/overlay` route, and the cross-origin isolation headers that multithreaded ONNX Runtime needs.
2. Deploy the site; no Redis database or Vercel Function is needed for the live overlay connection.

The build runs `npm run setup` (see below). Vercel's build image already includes `tar` with zstd support.

## Development

The scanner UI uses Kobalte's Solid 2-compatible alpha for accessible controls; other form controls use native HTML elements.

```bash
git clone https://github.com/jpinz/obs-mtg-scanner.git
cd obs-mtg-scanner
npm install
npm run dev        # http://localhost:5173
npm test           # vitest
npm run typecheck
```

`npm run dev` serves the app and its `/overlay` page through Vite. OBS must be running locally for the overlay to receive card updates. `npm run build && npm run preview` does the same for a production build.

`npm run dev` and `npm run build` first run `npm run setup`. That copies the forked scanner sources from `collectorvision/` and downloads CollectorVision's prebuilt model/catalog bundle (~43 MB, cached in `.cache/`) into `public/collectorvision/`. Run `node scripts/fetch-collectorvision.mjs --force` to refresh it. Extraction needs a `tar` with zstd support (built into Windows 10+ and macOS).

## License

AGPL-3.0, because this project bundles and serves CollectorVision, which is AGPL-3.0 licensed. Card data and images © Wizards of the Coast, provided via Scryfall.
