---
name: ManaCast
description: The Tabletop — matte teal fields, ink workspaces and yellow actions.
colors:
  landing-teal: "#087f83"
  landing-ink: "#082c38"
  bg: "#08232c"
  surface: "#10333c"
  surface-input: "#082630"
  border: "#365d65"
  border-control: "#76969b"
  fg: "#f4f8ec"
  muted: "#b3ccca"
  accent: "#ffd45c"
  focus: "#8ae6da"
typography:
  display:
    fontFamily: '"Bricolage Grotesque", sans-serif'
    fontSize: "clamp(3.25rem, 6.8vw, 6rem)"
    fontWeight: 700
    lineHeight: 0.99
    letterSpacing: "-0.04em"
  headline:
    fontFamily: '"Bricolage Grotesque", sans-serif'
    fontSize: "clamp(2.25rem, 4vw, 3.75rem)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.035em"
  title:
    fontFamily: '"Bricolage Grotesque", sans-serif'
    fontSize: "1.4rem"
    fontWeight: 700
    lineHeight: 1.25
  app-title:
    fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif'
    fontSize: "1.5rem"
    fontWeight: 650
    lineHeight: 1.35
    letterSpacing: "-0.025em"
  body:
    fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif'
    fontSize: "1rem"
    lineHeight: 1.6
  app-section:
    fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif'
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.35
  label:
    fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif'
    fontSize: "0.8rem"
    lineHeight: 1.35
  check-label:
    fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif'
    fontSize: "0.85rem"
    lineHeight: 1.35
rounded:
  check: "0.25rem"
  compact: "0.35rem"
  landing-control: "0.4rem"
  field: "0.45rem"
  preview: "0.6rem"
  panel: "0.75rem"
spacing:
  tight: "0.4rem"
  small: "0.5rem"
  related: "0.75rem"
  standard: "1rem"
  panel: "1.25rem"
  section: "1.5rem"
  wide: "2rem"
  generous: "3rem"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#171109"
    rounded: "{rounded.field}"
    padding: "0.55rem 0.95rem"
  button-primary-hover:
    backgroundColor: "#ffe18a"
  button-secondary:
    backgroundColor: "#1a414a"
    textColor: "{colors.fg}"
    rounded: "{rounded.field}"
    padding: "0.55rem 0.95rem"
  button-secondary-hover:
    backgroundColor: "#23535b"
  landing-launch:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.landing-ink}"
    rounded: "{rounded.landing-control}"
    padding: "0.8rem 1.25rem"
  field:
    backgroundColor: "{colors.surface-input}"
    textColor: "{colors.fg}"
    rounded: "{rounded.field}"
    padding: "0.55rem 0.7rem"
  tab-selected:
    backgroundColor: "#1b4951"
    textColor: "{colors.fg}"
    rounded: "{rounded.landing-control}"
    padding: "0.65rem 0.3rem"
  resolution-tag:
    textColor: "{colors.muted}"
    rounded: "{rounded.compact}"
    padding: "0.3rem 0.55rem"
  controls-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.panel}"
  checkbox-checked:
    backgroundColor: "{colors.accent}"
    textColor: "#16120a"
    rounded: "{rounded.check}"
    size: "1.1rem"
---

# Design System: ManaCast

## Overview

**Creative North Star: "The Tabletop"**

A matte printed-playmat world: teal fields, deep ink working zones, ivory lettering and yellow moments of action. Thin rules divide continuous surfaces rather than making every item a floating card. Landing display lettering is expressive; the streaming workspace translates the same materials into quiet, compact controls.

The ManaCast mark pairs an outlined card with yellow broadcast signals on an ink tile. It appears beside the wordmark and as the browser favicon.

The shared palette does not imply identical typography or density. The landing uses self-hosted Bricolage Grotesque for headings; the app uses the system UI stack for operative text. The display face is not loaded by the app entry point.

**Key Characteristics:**
- Matte tonal zones with thin, visible boundaries.
- Yellow actions and selected controls against ink and teal.
- Expressive landing headings; restrained, labelled app controls.
- SVG iconography and visible keyboard focus.

Evidence: `src/landing/landing.css`, `src/app/app.css`, `src/landing/Landing.tsx`, `src/app/App.tsx`, `src/landing/main.tsx`, `index.html` and `app.html`. The frontmatter records reused source values, not every illustration color or one-off measurement. The sidecar's synthesized tonal ramps are panel previews, not additional approved source tokens.

## Colors

### Primary
- **Tabletop Teal** (`landing-teal`): broad landing fields and navigation.
- **Action Yellow** (`accent`): launch and primary buttons, checked controls, editing boundaries and the illustrative result panel. Shared with the landing's yellow custom property.

### Secondary
- **Focus Mint** (`focus`): app keyboard outlines and supporting links; not a replacement primary action color.

### Neutral
- **Landing Ink** (`landing-ink`): landing working zones and dark lettering.
- **Workspace Ink** (`bg`): app canvas.
- **Raised Ink** (`surface`): app panels and containers.
- **Recessed Ink** (`surface-input`): editable fields.
- **Ivory** (`fg`): main app text and landing paper/text, shared with the landing's paper custom property.
- **Muted Sea Glass** (`muted`): app supporting text and inactive tabs.
- **Zone Rule** (`border`): app panel boundaries and separators.
- **Control Rule** (`border-control`): stronger input and selected-tab boundaries.

**The Yellow Has Work Rule.** Yellow marks actions, selected controls and live editing or result information; it is not restricted to buttons.

Status colors remain semantic: active dots use green (`#76cfa6`); error text uses warm pink (`#ffb4ad`) with a brighter error dot (`#ff9a91`). Status messages include text rather than relying on dots alone.

## Typography

**Display Font:** Bricolage Grotesque, sans-serif fallback. The variable font is self-hosted at `assets/fonts/bricolage-grotesque-latin.woff2`, declared for weights 400–700 with swap loading; its license is `public/fonts/OFL.txt`.

**Body Font:** Segoe UI, system-ui, -apple-system, sans-serif. This also supplies all app headings; those are task labels, not landing display typography.

### Hierarchy
- **Display / Headline / Title:** frontmatter roles map to the landing hero, section headings and setup-step headings. At the landing narrow breakpoint, Display becomes `clamp(2.75rem, 9vw, 4.5rem)` with line-height (1.05).
- **App title / App section:** preview heading and compact panel headings respectively.
- **Body:** landing prose; supporting paragraphs commonly step down to (0.9rem). Hero supporting text uses (1.05rem), line-height (1.55), and a (36ch) measure, becoming (0.95rem) at the intermediate breakpoint and up to (45ch) on narrow screens.
- **Label / Check label:** app field labels and checkbox text. Help uses (0.8rem) with line-height (1.45). App metadata commonly uses (0.75–0.85rem).
- Numeric outputs, resolution tags, counters and setup-step numbers use tabular figures.

**The Two Registers Rule.** Keep Bricolage's expressive landing headings distinct from the app's compact system UI hierarchy.

## Layout

The landing uses continuous full-width color fields with bounded content (1480px), desktop horizontal gutters (4.5%) and narrow gutters (5%). Repeated section gaps and padding use the larger spacing steps; app groups use the tighter steps. This is a set of reused intervals, not a strict mathematical spacing scale.

The app's bounded workspace (1600px) places a flexible preview beside a fixed settings column (24rem), with a (1.5rem) gap and padding (1.5rem 2rem 3rem). The sidebar is sticky (top 1.5rem), independently scrollable, and limited to `calc(100dvh - 8rem)`. The camera frame is (16 / 9); the embedded overlay keeps its (1920 × 1080) coordinate canvas and scales to fit.

At (1000px) and below, the app becomes one column with preview and card history first, and the sidebar loses sticky positioning and its scroll limit. Tabs become five columns; at (600px) and below they return to three columns and workspace side padding becomes (1rem). On desktop they form three columns over two rows.

Landing intermediate adjustments begin at (1000px). At (700px), hero and demo stack, secondary navigation links disappear while Launch app remains, and explanatory grids become a single column. Setup steps retain a number column with the text beside it.

## Elevation & Depth

The interface is flat by default: tonal differences, one-pixel rules, stronger control borders and clipping establish hierarchy. App panels and controls do not carry ambient shadows.

The illustrative playing card alone has a soft shadow (`0 12px 22px #041c2859`) and a small rotation (-7deg), conveying a physical object over the mat. This is illustration depth, not a panel elevation scale. The editing-zone label's small text shadow is a local video-legibility treatment, not a reusable surface shadow.

**The Mat Before Lift Rule.** Use tonal zones and rules for interface depth; reserve the physical-card shadow for the illustrative object.

## Shapes

Gently rounded rectangles carry the controls and containers, using the frontmatter's distinct field, preview and panel radii. One-pixel solid boundaries are normal, not a forbidden device. Circular status dots, setup-step numbers and switch thumbs have specific informational roles.

Dashed outlines are native to this world: the illustrative card placement zone and selected ignore regions use them. Do not prohibit them globally. Icons are stroked inline SVG with rounded caps/joins where defined; the text-size reset uses an SVG cross, not a character glyph.

## Components

### Buttons

Compact, explicit and high-contrast. App primary and secondary variants share the frontmatter padding and field radius, a minimum height (2.5rem), type (0.85rem / 600), and a border-color transition (150ms ease). Primary hover lightens yellow; secondary hover lightens its ink fill and border. Disabled buttons use opacity (0.55) and a not-allowed cursor.

Landing launch links have a minimum height (3.25rem), type (1rem / 700), and a larger gap between label and SVG arrow. They are links to `./app.html`, not in-place scanner controls.

App keyboard outlines use Focus Mint (2px, offset 2px); the checkbox visual control uses offset (3px). Landing interactive focus uses currentColor (3px, offset 5px). Reduced-motion removes the app button transition.

### Chips / Tags

The resolution tag is a compact, noninteractive outlined label with muted text, tabular figures and the compact radius. It is not a filter pill or a selected-state action.

### Cards / Containers

App settings/history panels use Raised Ink, Zone Rule borders and the panel radius. Internal groups generally have padding (1.25rem) and top separators. The OBS source container uses the preview radius. The landing demo uses a clipped panel-radius boundary with ink zones and internal rules rather than a stack of elevated feature cards.

### Inputs / Fields

Text, numeric, password and select fields share Recessed Ink, Control Rule borders and the field radius, with minimum height (2.5rem) and type (0.85rem). Hover shifts the border to Muted Sea Glass; focus uses the shared app outline. Range and color inputs preserve their native control behavior and use the shared palette.

Checkbox controls are square and gently rounded, with an SVG check on yellow when selected. Disabled checkbox groups use opacity (0.5). Maintain visible labels, including when a compact numeric control uses a visually hidden accessible label.

### Navigation

Landing navigation is an inline row on teal, with an outlined launch link retained at narrow widths. The app has five labelled tabs: Camera, Recognition, Overlay, Effects and OBS setup. Card history remains visible beneath the streaming note, and the saved-cards summary links to it. Inactive tab text is muted; selected tabs use the frontmatter selected-tab fill and Control Rule border; hover uses Raised Ink. Tabs expose selected state and roving keyboard focus, with arrow/Home/End navigation.

**The Continuous Preview Rule.** Switching panels changes the settings view without unmounting either the camera stage or preview iframe.

### Inline Detail Sizing

Card name, Card details and every detail checkbox share a two-column row: flexible labelled checkbox, then an inline pixel override. The number field is (4.5rem) wide with minimum height (2rem); the unit and reset stay beside it. Empty values inherit the displayed size. Unchecked options disable their override. The reset is a (1.6rem) square SVG button; when absent its slot stays reserved to avoid row movement.

### OBS Overlay Panels

Name, Details, Total value, Highest-value card and Follow panels use Raised Ink, Ivory and Muted Sea Glass, with thin full borders and a (0.6em) radius. Avoid accent stripes and floating-panel shadows; yellow emphasizes price information. The light theme reverses to Ivory with ink text and darker accent and rarity colors for readability.

Each panel has an independent background-opacity slider beside its visibility control, disabled when the panel is off. Values range from 0–100%, defaulting to 88%, and persist with overlay settings. Apply alpha only to the fill and boundary, never to text or artwork. The standalone card image has no background-opacity control. Evidence: `src/overlay/overlay.css`, `src/overlay/Pinned.tsx`, `src/overlay/FollowPanel.tsx`, `src/settings.ts` and `src/app/App.tsx`.

### Illustrative Overlay Toggle

The landing toggle has a textual label and pressed state. Its result panel uses opacity and a vertical movement (8px) over (220ms), with easing `cubic-bezier(0.16, 1, 0.3, 1)`. Reduced-motion removes both transition and movement. This demonstration does not initialize the scanner or activate a camera.

## Do's and Don'ts

### Do:
- **Do** retain matte tonal zones, thin boundaries and stronger input edges.
- **Do** use the expressive landing and restrained app type registers for their established roles.
- **Do** keep camera and iframe mounted while settings panels switch.
- **Do** keep detail-size overrides inline with their checkbox and retain accessible labels.
- **Do** preserve visible keyboard focus, SVG controls and reduced-motion fallbacks.

### Don't:
- **Don't** turn the illustrative card's soft shadow into app panel elevation.
- **Don't** replace the app's labelled native controls with decorative display treatments.
- **Don't** hide the landing launch action with secondary mobile navigation.
- **Don't** turn illustration microtype into a reusable body-text size.

Not canonized or repaired: the illustrative card contains very small miniature print, not a general reading-text token; PRODUCT.md's relay architecture is stale against source/README direct local OBS WebSocket transport and is outside this visual record. The reset SVG is present in source; the finish reviewer returned ship after its fix.
