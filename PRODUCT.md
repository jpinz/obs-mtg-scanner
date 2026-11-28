# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Magic: The Gathering streamers who want to identify cards shown to a webcam and display card details in an OBS overlay.

## Product Purpose

Help streamers show viewers useful information about cards as they appear on camera. Success means recognizing a card and displaying its information in the stream without requiring OBS to access the webcam.

## Positioning

The scanner runs in a regular browser tab that owns the webcam, while a separate display-only URL publishes the card panel to OBS as a Browser Source. The app also previews that overlay over the camera feed.

## Operating Context

The streamer opens the app in a desktop browser, selects a webcam, starts scanning, and holds cards up to the camera. They configure recognition and overlay options, copy the per-browser overlay URL into OBS, and keep the scanner tab open while streaming. If another application owns the webcam, they must release it or use a virtual camera.

## Capabilities and Constraints

- Select a camera and requested resolution, preview the feed, and mirror the preview.
- Configure recognition threshold, set-code and Scryfall-query filters, and card-panel display options.
- Recognition runs in the browser using ONNX Runtime Web and a fork of CollectorVision with the live v2 Milo embedding catalog.
- Webcam video stays in the browser. Card details, not video, are sent to the overlay relay.
- Card information and prices come from Scryfall.
- The OBS overlay is display-only and does not need camera permission or OBS's `--enable-media-stream` flag.
- The hosted app uses Vercel and a Redis-backed function to relay overlay state. The scanner tab must remain open to publish updates.
- The project is licensed AGPL-3.0-only and includes AGPL-licensed CollectorVision code. Card data and images are provided through Scryfall; Wizards of the Coast retains its rights to card content.

## Brand Commitments

The product is named ManaCast. Its identity combines a card with broadcast signals in the existing tabletop teal, ink, ivory, and yellow palette.

## Evidence on Hand

- The working scanner and overlay implementation is in `src/app/` and `src/overlay/`.
- The CollectorVision fork and its documentation are in `collectorvision/`.
- Scryfall is the source for card details and prices.
- No customer testimonials, benchmarks, or other outcome claims have been established; do not invent them.

## Product Principles

- Keep webcam video on the user's device.
- Keep camera capture in the scanner app and make the OBS source display-only.
- Make card recognition and overlay settings controllable by the streamer.
- Attribute card information to its documented source rather than presenting it as original data.
