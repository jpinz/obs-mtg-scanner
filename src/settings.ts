export const CURRENCIES = ["usd", "usd_foil", "usd_etched", "eur", "eur_foil", "tix"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_LABELS: Record<Currency, string> = {
  usd: "USD",
  usd_foil: "USD foil",
  usd_etched: "USD etched",
  eur: "EUR",
  eur_foil: "EUR foil",
  tix: "MTGO",
};

export const LAYOUT_ITEMS = ["image", "name", "details", "total"] as const;
export type LayoutItem = (typeof LAYOUT_ITEMS)[number];

/** Top-left corner of a pinned component as a fraction (0–1) of the overlay canvas. */
export interface LayoutPosition {
  x: number;
  y: number;
}

/** A pinned component's box; every value is a fraction (0–1) of the overlay canvas width or height. */
export interface LayoutBox extends LayoutPosition {
  width: number;
  height: number;
}

export type OverlayLayout = Readonly<Record<LayoutItem, LayoutBox>>;

/** Smallest width or height of a pinned component, as a fraction of the canvas. */
export const MIN_LAYOUT_SIZE = 0.02;

/** Allowed text sizes in canvas px. */
export const TEXT_SIZE_RANGE = Object.freeze({ min: 8, max: 96 });

/** Canvas the default layout and legacy pixel settings are expressed against. */
const REFERENCE_CANVAS = { width: 1920, height: 1080 };
const CARD_ASPECT = 680 / 488;

export const DETAIL_FIELDS = ["set", "number", "rarity", "price", "confidence"] as const;
export type DetailField = (typeof DETAIL_FIELDS)[number];

export const DETAIL_FIELD_LABELS: Record<DetailField, string> = {
  set: "Set name",
  number: "Set code and number",
  rarity: "Rarity",
  price: "Price",
  confidence: "Confidence score",
};

export const FOLLOW_SIDES = ["top", "bottom", "left", "right"] as const;
export type FollowSide = (typeof FOLLOW_SIDES)[number];

export const THEMES = ["dark", "light"] as const;
export type Theme = (typeof THEMES)[number];

export interface Resolution {
  width: number;
  height: number;
}

/** Axis-aligned box in unmirrored camera-frame coordinates, normalized to 0–1. */
export interface IgnoreZone {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const MIN_IGNORE_ZONE_AREA = 0.0000005;

export interface OverlaySettings {
  currency: Currency;
  allFinishes: boolean;
  showImage: boolean;
  showName: boolean;
  showDetails: boolean;
  showTotal: boolean;
  details: readonly DetailField[];
  layout: OverlayLayout;
  /** Base text size in canvas px for every overlay component. */
  textSize: number;
  /** Card name size in px for the pinned Name component; null inherits (1.25 × textSize). */
  nameTextSize: number | null;
  /** Base size in px for the pinned Details component; null inherits textSize. */
  detailsTextSize: number | null;
  /** Per detail line size in px, overriding the Details base size for that line. */
  detailTextSizes: Readonly<Partial<Record<DetailField, number>>>;
  /** Base size in px for the follow panel; null inherits textSize. */
  followTextSize: number | null;
  /** Shows a compact panel beside the tracked card. */
  follow: boolean;
  followSides: readonly FollowSide[];
  /** Seconds the panel stays visible after the card leaves the frame; 0 keeps it until the next card. */
  duration: number;
  /** Minimum embedding match score (0–1) before a card is accepted. */
  threshold: number;
  setCodes: readonly string[];
  query: string;
  /** MediaDeviceInfo.deviceId; empty string selects the default camera. */
  camera: string;
  resolution: Resolution;
  mirror: boolean;
  ignoreZones: readonly IgnoreZone[];
  theme: Theme;
  accent: string;
  debug: boolean;
}

export const DEFAULT_SETTINGS: Readonly<OverlaySettings> = Object.freeze({
  currency: "usd",
  allFinishes: false,
  showImage: true,
  showName: true,
  showDetails: true,
  showTotal: true,
  details: Object.freeze<DetailField[]>([...DETAIL_FIELDS]),
  layout: Object.freeze({
    image: Object.freeze({ x: 0.8, y: 0.06, ...imageSizeFor(300) }),
    name: Object.freeze({ x: 0.8, y: 0.47, width: 0.18, height: 0.05 }),
    details: Object.freeze({ x: 0.8, y: 0.53, width: 0.18, height: 0.2 }),
    total: Object.freeze({ x: 0.02, y: 0.05, width: 0.18, height: 0.09 }),
  }),
  textSize: 16,
  nameTextSize: null,
  detailsTextSize: null,
  detailTextSizes: Object.freeze({}),
  followTextSize: null,
  follow: false,
  followSides: Object.freeze<FollowSide[]>(["top", "bottom"]),
  duration: 8,
  threshold: 0.5,
  setCodes: Object.freeze([]),
  query: "",
  camera: "",
  resolution: Object.freeze({ width: 1280, height: 720 }),
  mirror: false,
  ignoreZones: Object.freeze([]),
  theme: "dark",
  accent: "#f59e0b",
  debug: false,
});

/** Box size for a card picture `widthPx` wide on the reference canvas. */
function imageSizeFor(widthPx: number): { width: number; height: number } {
  const round = (value: number) => Math.round(value * 10000) / 10000;
  return {
    width: round(widthPx / REFERENCE_CANVAS.width),
    height: round((widthPx * CARD_ASPECT) / REFERENCE_CANVAS.height),
  };
}

const PARAM = {
  currency: "currency",
  allFinishes: "finishes",
  showImage: "image",
  showName: "name",
  showDetails: "info",
  showTotal: "total",
  details: "details",
  textSize: "ts",
  nameTextSize: "nts",
  detailsTextSize: "dts",
  detailTextSizes: "dsz",
  followTextSize: "fts",
  follow: "follow",
  followSides: "sides",
  duration: "duration",
  threshold: "threshold",
  setCodes: "setcode",
  query: "query",
  camera: "camera",
  resolution: "res",
  mirror: "mirror",
  ignoreZones: "ignore",
  theme: "theme",
  accent: "accent",
  debug: "debug",
} as const satisfies Record<Exclude<keyof OverlaySettings, "layout">, string>;

/** Params from older overlay URLs that are translated into the current settings. */
const LEGACY_PARAM = {
  /** Panel size multiplier; becomes `textSize = 16 × scale`. */
  scale: "scale",
  /** Picture width in reference-canvas px; becomes the picture box size. */
  imageWidth: "iw",
} as const;

const LAYOUT_PARAM = {
  image: "ipos",
  name: "npos",
  details: "dpos",
  total: "tpos",
} as const satisfies Record<LayoutItem, string>;

const EMPTY_LIST = "none";

function parseEnum<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function parseBool(value: string | null, fallback: boolean): boolean {
  if (value === null) return fallback;
  const v = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(v)) return true;
  if (["0", "false", "no", "off"].includes(v)) return false;
  return fallback;
}

function parseNumber(value: string | null, fallback: number, min: number, max: number): number {
  if (value === null || value.trim() === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Parses a comma list into `allowed` order, dropping duplicates and unknown values; `none` or empty means no items. */
function parseList<T extends string>(value: string | null, allowed: readonly T[], fallback: readonly T[]): T[] {
  if (value === null) return [...fallback];
  const v = value.trim().toLowerCase();
  if (v === "" || v === EMPTY_LIST) return [];
  const items = new Set(v.split(",").map((item) => item.trim()));
  return allowed.filter((item) => items.has(item));
}

function serializeList(values: readonly string[]): string {
  return values.length === 0 ? EMPTY_LIST : values.join(",");
}

function roundFraction(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/** Clamps a box so it keeps at least the minimum size and stays fully inside the canvas. */
export function clampLayoutBox(box: LayoutBox): LayoutBox {
  const width = Math.min(1, Math.max(MIN_LAYOUT_SIZE, box.width));
  const height = Math.min(1, Math.max(MIN_LAYOUT_SIZE, box.height));
  return {
    x: Math.min(1 - width, Math.max(0, box.x)),
    y: Math.min(1 - height, Math.max(0, box.y)),
    width,
    height,
  };
}

/** Parses `x,y,width,height`; the legacy `x,y` form keeps the fallback size. */
function parseLayoutBox(value: string | null, fallback: LayoutBox): LayoutBox {
  const parts = value?.split(",").map((part) => part.trim());
  if (!parts || (parts.length !== 2 && parts.length !== 4) || parts.some((part) => part === "")) return { ...fallback };
  const numbers = parts.map(Number);
  if (numbers.some((n) => !Number.isFinite(n))) return { ...fallback };
  const [x, y, width = fallback.width, height = fallback.height] = numbers;
  return clampLayoutBox({ x, y, width, height });
}

function serializeLayoutBox(box: LayoutBox): string {
  const b = clampLayoutBox(box);
  return [b.x, b.y, b.width, b.height].map(roundFraction).join(",");
}

/** Returns a copy of `layout` with one item's box replaced; non-finite values keep the current value. */
export function setLayoutBox(layout: OverlayLayout, item: LayoutItem, box: Partial<LayoutBox>): OverlayLayout {
  const current = layout[item];
  const pick = (key: keyof LayoutBox) => {
    const value = box[key];
    return typeof value === "number" && Number.isFinite(value) ? value : current[key];
  };
  return {
    ...layout,
    [item]: clampLayoutBox({ x: pick("x"), y: pick("y"), width: pick("width"), height: pick("height") }),
  };
}

function parseTextSize(value: string | null, fallback: number): number {
  return Math.round(parseNumber(value, fallback, TEXT_SIZE_RANGE.min, TEXT_SIZE_RANGE.max));
}

function parseOptionalTextSize(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? parseTextSize(value, TEXT_SIZE_RANGE.min) : null;
}

/** Parses `field:size` pairs such as `set:14,price:24`, dropping unknown fields and invalid sizes. */
function parseDetailTextSizes(value: string | null): Partial<Record<DetailField, number>> {
  const sizes: Partial<Record<DetailField, number>> = {};
  if (!value) return sizes;
  for (const pair of value.split(",")) {
    const [field, size] = pair.split(":").map((part) => part.trim().toLowerCase());
    if (!(DETAIL_FIELDS as readonly string[]).includes(field)) continue;
    const parsed = parseOptionalTextSize(size ?? null);
    if (parsed !== null) sizes[field as DetailField] = parsed;
  }
  return sizes;
}

function serializeDetailTextSizes(sizes: Readonly<Partial<Record<DetailField, number>>>): string {
  return DETAIL_FIELDS.filter((field) => sizes[field] !== undefined).map((field) => `${field}:${sizes[field]}`).join(",");
}

function parseResolution(value: string | null, fallback: Resolution): Resolution {
  const match = value?.trim().match(/^(\d{2,5})x(\d{2,5})$/i);
  if (!match) return { ...fallback };
  return { width: Number(match[1]), height: Number(match[2]) };
}

function parseColor(value: string | null, fallback: string): string {
  if (value === null) return fallback;
  const v = value.trim();
  const hex = v.startsWith("#") ? v : `#${v}`;
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex) ? hex.toLowerCase() : fallback;
}

function legacyIgnoreBox(zone: unknown): IgnoreZone | null {
  if (!Array.isArray(zone) || zone.length !== 4
    || !zone.every((point) => Array.isArray(point) && point.length === 2
      && point.every((n) => typeof n === "number" && Number.isFinite(n)))) return null;

  const x = Math.min(...zone.map((point) => point[0]));
  const y = Math.min(...zone.map((point) => point[1]));
  const right = Math.max(...zone.map((point) => point[0]));
  const bottom = Math.max(...zone.map((point) => point[1]));
  if (new Set(zone.map(([px, py]) => `${px},${py}`)).size !== 4
    || !zone.every(([px, py]) => (px === x || px === right) && (py === y || py === bottom))
    || !zone.every(([px, py], i) => {
      const [nextX, nextY] = zone[(i + 1) % zone.length];
      return (px === nextX) !== (py === nextY);
    })) return null;
  return { x, y, width: right - x, height: bottom - y };
}

function isIgnoreBox(zone: unknown): zone is IgnoreZone {
  if (!zone || typeof zone !== "object" || Array.isArray(zone)) return false;
  const { x, y, width, height } = zone as IgnoreZone;
  return [x, y, width, height].every((n) => typeof n === "number" && Number.isFinite(n))
    && x >= 0 && y >= 0 && width > 0 && height > 0
    && width <= 1 - x && height <= 1 - y
    && width * height > MIN_IGNORE_ZONE_AREA;
}

function parseIgnoreZones(value: string | null): IgnoreZone[] {
  if (!value) return [];
  try {
    const zones: unknown = JSON.parse(value);
    if (!Array.isArray(zones)) return [];
    return zones.flatMap((zone) => {
      const box = Array.isArray(zone) ? legacyIgnoreBox(zone) : zone;
      if (!isIgnoreBox(box)) return [];
      return [{ x: box.x, y: box.y, width: box.width, height: box.height }];
    });
  } catch {
    return [];
  }
}

export function parseSettings(search: string | URLSearchParams): OverlaySettings {
  const p = typeof search === "string" ? new URLSearchParams(search) : search;
  const d = DEFAULT_SETTINGS;
  const legacyImageWidth = p.get(LEGACY_PARAM.imageWidth);
  const imageFallback: LayoutBox = legacyImageWidth === null
    ? d.layout.image
    : { ...d.layout.image, ...imageSizeFor(parseNumber(legacyImageWidth, 300, 80, 1200)) };
  const legacyScale = p.get(LEGACY_PARAM.scale);
  const textSizeFallback = legacyScale === null ? d.textSize : d.textSize * parseNumber(legacyScale, 1, 0.25, 4);
  return {
    currency: parseEnum(p.get(PARAM.currency), CURRENCIES, d.currency),
    allFinishes: parseBool(p.get(PARAM.allFinishes), d.allFinishes),
    showImage: parseBool(p.get(PARAM.showImage), d.showImage),
    showName: parseBool(p.get(PARAM.showName), d.showName),
    showDetails: parseBool(p.get(PARAM.showDetails), d.showDetails),
    showTotal: parseBool(p.get(PARAM.showTotal), d.showTotal),
    details: parseList(p.get(PARAM.details), DETAIL_FIELDS, d.details),
    layout: {
      image: parseLayoutBox(p.get(LAYOUT_PARAM.image), imageFallback),
      name: parseLayoutBox(p.get(LAYOUT_PARAM.name), d.layout.name),
      details: parseLayoutBox(p.get(LAYOUT_PARAM.details), d.layout.details),
      total: parseLayoutBox(p.get(LAYOUT_PARAM.total), d.layout.total),
    },
    textSize: parseTextSize(p.get(PARAM.textSize), textSizeFallback),
    nameTextSize: parseOptionalTextSize(p.get(PARAM.nameTextSize)),
    detailsTextSize: parseOptionalTextSize(p.get(PARAM.detailsTextSize)),
    detailTextSizes: parseDetailTextSizes(p.get(PARAM.detailTextSizes)),
    followTextSize: parseOptionalTextSize(p.get(PARAM.followTextSize)),
    follow: parseBool(p.get(PARAM.follow), d.follow),
    followSides: parseList(p.get(PARAM.followSides), FOLLOW_SIDES, d.followSides),
    duration: parseNumber(p.get(PARAM.duration), d.duration, 0, 3600),
    threshold: parseNumber(p.get(PARAM.threshold), d.threshold, 0, 1),
    setCodes: [...new Set(p.getAll(PARAM.setCodes)
      .flatMap((value) => value.split(","))
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value !== ""))],
    query: p.get(PARAM.query)?.trim() ?? d.query,
    camera: p.get(PARAM.camera)?.trim() ?? d.camera,
    resolution: parseResolution(p.get(PARAM.resolution), d.resolution),
    mirror: parseBool(p.get(PARAM.mirror), d.mirror),
    ignoreZones: parseIgnoreZones(p.get(PARAM.ignoreZones)),
    theme: parseEnum(p.get(PARAM.theme), THEMES, d.theme),
    accent: parseColor(p.get(PARAM.accent), d.accent),
    debug: parseBool(p.get(PARAM.debug), d.debug),
  };
}

/** Serializes settings to query params, omitting values equal to the defaults to keep URLs short. */
export function serializeSettings(settings: OverlaySettings): URLSearchParams {
  const p = new URLSearchParams();
  const d = DEFAULT_SETTINGS;
  const set = (key: keyof typeof PARAM, value: string, defaultValue: string) => {
    if (value !== defaultValue) p.set(PARAM[key], value);
  };
  const bool = (b: boolean) => (b ? "1" : "0");
  const res = (r: Resolution) => `${r.width}x${r.height}`;

  set("currency", settings.currency, d.currency);
  set("allFinishes", bool(settings.allFinishes), bool(d.allFinishes));
  set("showImage", bool(settings.showImage), bool(d.showImage));
  set("showName", bool(settings.showName), bool(d.showName));
  set("showDetails", bool(settings.showDetails), bool(d.showDetails));
  set("showTotal", bool(settings.showTotal), bool(d.showTotal));
  set("details", serializeList(settings.details), serializeList(d.details));
  for (const item of LAYOUT_ITEMS) {
    const value = serializeLayoutBox(settings.layout[item]);
    if (value !== serializeLayoutBox(d.layout[item])) p.set(LAYOUT_PARAM[item], value);
  }
  const optional = (size: number | null) => (size === null ? "" : String(size));
  set("textSize", String(settings.textSize), String(d.textSize));
  set("nameTextSize", optional(settings.nameTextSize), "");
  set("detailsTextSize", optional(settings.detailsTextSize), "");
  set("detailTextSizes", serializeDetailTextSizes(settings.detailTextSizes), "");
  set("followTextSize", optional(settings.followTextSize), "");
  set("follow", bool(settings.follow), bool(d.follow));
  set("followSides", serializeList(settings.followSides), serializeList(d.followSides));
  set("duration", String(settings.duration), String(d.duration));
  set("threshold", String(settings.threshold), String(d.threshold));
  set("setCodes", settings.setCodes.join(","), d.setCodes.join(","));
  set("query", settings.query, d.query);
  set("camera", settings.camera, d.camera);
  set("resolution", res(settings.resolution), res(d.resolution));
  set("mirror", bool(settings.mirror), bool(d.mirror));
  set("ignoreZones", JSON.stringify(settings.ignoreZones), "[]");
  set("theme", settings.theme, d.theme);
  set("accent", settings.accent, d.accent);
  set("debug", bool(settings.debug), bool(d.debug));
  return p;
}

/** Settings the overlay page itself uses; the rest only affect the scanner app. */
const OVERLAY_KEYS = [
  "currency",
  "allFinishes",
  "showImage",
  "showName",
  "showDetails",
  "showTotal",
  "details",
  "layout",
  "textSize",
  "nameTextSize",
  "detailsTextSize",
  "detailTextSizes",
  "followTextSize",
  "follow",
  "followSides",
  "theme",
  "accent",
  "debug",
] as const satisfies readonly (keyof OverlaySettings)[];

/** Query params for the overlay page (`/overlay`), leaving out scanner-only settings such as the camera. */
export function serializeOverlaySettings(settings: OverlaySettings): URLSearchParams {
  const all = serializeSettings(settings);
  const keep = new Set<string>(OVERLAY_KEYS.flatMap<string>((key) => (
    key === "layout" ? LAYOUT_ITEMS.map((item) => LAYOUT_PARAM[item]) : [PARAM[key]]
  )));
  return new URLSearchParams([...all].filter(([param]) => keep.has(param)));
}
