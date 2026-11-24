import { parseOverlayState } from "../overlayState";
import { formatPrice, type CardInfo } from "../scryfall";
import type { Currency } from "../settings";

export interface HistoryEntry {
  id: string;
  card: CardInfo;
  addedAt: string;
}

export const HISTORY_STORAGE_KEY = "mtg-scanner:history";

export function parseHistory(raw: string | null): HistoryEntry[] {
  if (raw === null) return [];
  const entries: unknown = JSON.parse(raw);
  if (!Array.isArray(entries)) throw new Error("Invalid saved history");
  return entries.map((entry: unknown) => {
    if (typeof entry !== "object" || entry === null) throw new Error("Invalid saved history entry");
    const value = entry as Record<string, unknown>;
    const state = parseOverlayState({ card: value.card, confidence: null });
    if (typeof value.id !== "string" || !value.id || typeof value.addedAt !== "string"
      || !Number.isFinite(Date.parse(value.addedAt)) || !state?.card) throw new Error("Invalid saved history entry");
    return { id: value.id, card: state.card, addedAt: value.addedAt };
  });
}

export function removeHistoryEntries(entries: readonly HistoryEntry[], ids: readonly string[]): HistoryEntry[] {
  const removed = new Set(ids);
  return entries.filter((entry) => !removed.has(entry.id));
}

export function summarizeHistory(entries: readonly HistoryEntry[], currency: Currency) {
  let cents = 0;
  let missing = 0;
  let fallback = 0;
  for (const { card } of entries) {
    const price = formatPrice(card, currency);
    if (!price) {
      missing += 1;
    } else {
      cents += Math.round(Number(card.prices[price.currency]) * 100);
      if (price.currency !== currency) fallback += 1;
    }
  }
  const amount = (cents / 100).toFixed(2);
  const text = currency.startsWith("usd") ? `$${amount}` : currency.startsWith("eur") ? `€${amount}` : `${amount} TIX`;
  return { text, missing, fallback, count: entries.length };
}
