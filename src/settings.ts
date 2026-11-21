export const CURRENCIES = ["usd", "usd_foil", "usd_etched", "eur", "eur_foil", "tix"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const POSITIONS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;
export type PanelPosition = (typeof POSITIONS)[number];

export const THEMES = ["dark", "light"] as const;
export type Theme = (typeof THEMES)[number];

export const CATALOGS = ["v2", "v1"] as const;
export type CatalogMode = (typeof CATALOGS)[number];

export interface Resolution {
  width: number;
  height: number;
}

export interface OverlaySettings {
  currency: Currency;
  position: PanelPosition;
  showImage: boolean;
  showSet: boolean;
  /** Seconds the panel stays visible after the card leaves the frame; 0 keeps it until the next card. */
  duration: number;
  /** Minimum embedding match score (0–1) before a card is accepted. */
  threshold: number;
  /** `v2` follows CollectorVision's live catalog feed; `v1` uses the bundled offline snapshot. */
  catalog: CatalogMode;
  /** MediaDeviceInfo.deviceId; empty string selects the default camera. */
  camera: string;
  resolution: Resolution;
  mirror: boolean;
  theme: Theme;
  accent: string;
  scale: number;
  debug: boolean;
}

export const DEFAULT_SETTINGS: Readonly<OverlaySettings> = Object.freeze({
  currency: "usd",
  position: "bottom-right",
  showImage: true,
  showSet: true,
  duration: 8,
  threshold: 0.5,
  catalog: "v2",
  camera: "",
  resolution: Object.freeze({ width: 1280, height: 720 }),
  mirror: false,
  theme: "dark",
  accent: "#f59e0b",
  scale: 1,
  debug: false,
});

const PARAM = {
  currency: "currency",
  position: "pos",
  showImage: "image",
  showSet: "set",
  duration: "duration",
  threshold: "threshold",
  catalog: "catalog",
  camera: "camera",
  resolution: "res",
  mirror: "mirror",
  theme: "theme",
  accent: "accent",
  scale: "scale",
  debug: "debug",
} as const satisfies Record<keyof OverlaySettings, string>;

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

export function parseSettings(search: string | URLSearchParams): OverlaySettings {
  const p = typeof search === "string" ? new URLSearchParams(search) : search;
  const d = DEFAULT_SETTINGS;
  return {
    currency: parseEnum(p.get(PARAM.currency), CURRENCIES, d.currency),
    position: parseEnum(p.get(PARAM.position), POSITIONS, d.position),
    showImage: parseBool(p.get(PARAM.showImage), d.showImage),
    showSet: parseBool(p.get(PARAM.showSet), d.showSet),
    duration: parseNumber(p.get(PARAM.duration), d.duration, 0, 3600),
    threshold: parseNumber(p.get(PARAM.threshold), d.threshold, 0, 1),
    catalog: parseEnum(p.get(PARAM.catalog), CATALOGS, d.catalog),
    camera: p.get(PARAM.camera)?.trim() ?? d.camera,
    resolution: parseResolution(p.get(PARAM.resolution), d.resolution),
    mirror: parseBool(p.get(PARAM.mirror), d.mirror),
    theme: parseEnum(p.get(PARAM.theme), THEMES, d.theme),
    accent: parseColor(p.get(PARAM.accent), d.accent),
    scale: parseNumber(p.get(PARAM.scale), d.scale, 0.25, 4),
    debug: parseBool(p.get(PARAM.debug), d.debug),
  };
}

/** Serializes settings to query params, omitting values equal to the defaults to keep URLs short. */
export function serializeSettings(settings: OverlaySettings): URLSearchParams {
  const p = new URLSearchParams();
  const d = DEFAULT_SETTINGS;
  const set = (key: keyof OverlaySettings, value: string, defaultValue: string) => {
    if (value !== defaultValue) p.set(PARAM[key], value);
  };
  const bool = (b: boolean) => (b ? "1" : "0");
  const res = (r: Resolution) => `${r.width}x${r.height}`;

  set("currency", settings.currency, d.currency);
  set("position", settings.position, d.position);
  set("showImage", bool(settings.showImage), bool(d.showImage));
  set("showSet", bool(settings.showSet), bool(d.showSet));
  set("duration", String(settings.duration), String(d.duration));
  set("threshold", String(settings.threshold), String(d.threshold));
  set("catalog", settings.catalog, d.catalog);
  set("camera", settings.camera, d.camera);
  set("resolution", res(settings.resolution), res(d.resolution));
  set("mirror", bool(settings.mirror), bool(d.mirror));
  set("theme", settings.theme, d.theme);
  set("accent", settings.accent, d.accent);
  set("scale", String(settings.scale), String(d.scale));
  set("debug", bool(settings.debug), bool(d.debug));
  return p;
}
