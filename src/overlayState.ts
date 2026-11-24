import type { CardInfo } from "./scryfall";
// The explicit extension lets the Vercel function load this module as native ESM.
import { CURRENCIES, type Currency } from "./settings.js";

/** Shared card-state shape used when validating overlay event payloads. */
export interface OverlayState {
  card: CardInfo | null;
  confidence: number | null;
}

export const OVERLAY_API_PATH = "/api/overlay";
export const SESSION_PARAM = "session";
/** Marks the scanner app's embedded overlay preview, which must not show OBS connection UI. */
export const PREVIEW_PARAM = "preview";

const WRITE_KEY_PATTERN = /^[0-9a-f]{64}$/;
const SESSION_ID_PATTERN = /^[0-9a-f]{32}$/;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** A secret that only the scanner app holds; it authorizes publishing to one overlay session. */
export function createWriteKey(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

export function isWriteKey(value: unknown): value is string {
  return typeof value === "string" && WRITE_KEY_PATTERN.test(value);
}

export function isSessionId(value: unknown): value is string {
  return typeof value === "string" && SESSION_ID_PATTERN.test(value);
}

/**
 * The public, read-only ID that goes into the OBS URL. It is derived from the write key with
 * SHA-256, so anyone who sees the overlay URL can read the session but can't publish to it.
 */
export async function sessionIdFor(writeKey: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(writeKey));
  return toHex(new Uint8Array(digest)).slice(0, 32);
}

const currencySet = new Set<string>(CURRENCIES);
const STRING_FIELDS = ["id", "name", "setName", "setCode", "collectorNumber", "rarity", "scryfallUri"] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCardInfo(value: unknown): CardInfo | null {
  if (!isObject(value)) return null;
  for (const field of STRING_FIELDS) {
    if (typeof value[field] !== "string") return null;
  }
  if (value.id === "" || value.name === "") return null;

  const imageUrl = value.imageUrl;
  if (imageUrl !== null && (typeof imageUrl !== "string" || !imageUrl.startsWith("https://"))) return null;

  if (!isObject(value.prices)) return null;
  const prices: Partial<Record<Currency, string | null>> = {};
  for (const [key, price] of Object.entries(value.prices)) {
    if (currencySet.has(key) && (typeof price === "string" || price === null)) {
      prices[key as Currency] = price;
    }
  }

  const foilAvailable = value.foilAvailable;
  const assumedFoil = value.assumedFoil;
  if (foilAvailable !== undefined && typeof foilAvailable !== "boolean") return null;
  if (assumedFoil !== undefined && typeof assumedFoil !== "boolean") return null;

  return {
    id: value.id as string,
    name: value.name as string,
    setName: value.setName as string,
    setCode: value.setCode as string,
    collectorNumber: value.collectorNumber as string,
    rarity: value.rarity as string,
    imageUrl,
    prices,
    ...(foilAvailable === undefined ? {} : { foilAvailable }),
    ...(assumedFoil === undefined ? {} : { assumedFoil }),
    scryfallUri: value.scryfallUri as string,
  };
}

/** Validates untrusted JSON (POST bodies, stored and polled state); returns null when it is not a valid state. */
export function parseOverlayState(value: unknown): OverlayState | null {
  if (!isObject(value)) return null;
  const confidence = value.confidence;
  if (
    confidence !== undefined
    && confidence !== null
    && (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1)
  ) {
    return null;
  }
  if (value.card === null) {
    return confidence === undefined || confidence === null ? { card: null, confidence: null } : null;
  }
  const card = parseCardInfo(value.card);
  return card ? { card, confidence: confidence ?? null } : null;
}
