# CollectorVision web scanner (forked)

This directory is a fork of the browser scanner runtime from
[HanClinto/CollectorVision](https://github.com/HanClinto/CollectorVision),
`examples/web_scanner/`, taken at upstream commit
`8b295ab80a997766afc00c640a616c1f2716df21` (2026-10-05).

| File | Upstream path |
| --- | --- |
| `scanner.worker.mjs` | `examples/web_scanner/scanner.worker.mjs` |
| `lib/collectorvision-scanner-applet.mjs` | `examples/web_scanner/lib/collectorvision-scanner-applet.mjs` |
| `lib/collectorvision-catalog-v2.mjs` | `examples/web_scanner/lib/collectorvision-catalog-v2.mjs` |
| `assets.bundle.json` | `examples/web_scanner/assets.bundle.json` |
| `LICENSE` | `LICENSE` (AGPL-3.0) |

These files may be modified for the OBS overlay. Record local changes below so
upstream updates can be merged by hand.

`npm run setup` (`scripts/fetch-collectorvision.mjs`) copies these files into
`public/collectorvision/`, replaces `__BUILD_ID__` with a hash of their
contents, and extracts the prebuilt model/catalog/ONNX Runtime bundle from the
release named in `assets.bundle.json`.

## Local changes

- `lib/collectorvision-scanner-applet.mjs` and `scanner.worker.mjs`: always use
  the live v2 catalog instead of the bundled v1 snapshot. The applet also
  forwards `rotationInvariant` to the worker's `init` message.
- `lib/collectorvision-scanner-applet.mjs` and `scanner.worker.mjs`: forward an
  optional `allowedCardIds` list and restrict the loaded catalog before matching.
  `lib/collectorvision-catalog-filter.mjs` keeps selected embeddings, print IDs,
  names, and secondary IDs aligned for the live catalog. The app gets the
  allowed print IDs from Scryfall using the `setcode` and `query` URL options.
- `lib/collectorvision-scanner-applet.mjs`: masks configured ignore boxes in
  captured frames and rejects overlapping detections before confirmation.
