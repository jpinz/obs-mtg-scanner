import { describe, expect, it } from "vitest";
import type { CardInfo } from "../scryfall";
import { highestValueCard, parseHistory, removeHistoryEntries, replaceHistoryCard, summarizeHistory, type HistoryEntry } from "./history";

const card: CardInfo = {
  id: "one", name: "Card", setName: "Set", setCode: "SET", collectorNumber: "1",
  rarity: "rare", imageUrl: null, prices: { usd: "1.25", eur_foil: "2.50" },
  scryfallUri: "https://scryfall.com/card/set/1",
};
const entry: HistoryEntry = { id: "entry", card, addedAt: "2026-01-01T00:00:00.000Z" };

describe("card history", () => {
  it("round-trips printings and rejects invalid stored entries", () => {
    expect(parseHistory(JSON.stringify([entry]))).toEqual([entry]);
    expect(parseHistory(null)).toEqual([]);
    expect(() => parseHistory(JSON.stringify([{ ...entry, card: null }]))).toThrow();
  });

  it("preserves assumed foil metadata in saved history", () => {
    const foil = { ...entry, card: { ...card, foilAvailable: true, assumedFoil: true } };
    expect(parseHistory(JSON.stringify([foil]))).toEqual([foil]);
    expect(() => parseHistory(JSON.stringify([{ ...foil, card: { ...foil.card, assumedFoil: "yes" } }]))).toThrow();
  });

  it("retains a scan's foil assumption when replacing it with a foil-capable printing", () => {
    const foil = { ...entry, card: { ...card, foilAvailable: true, assumedFoil: true } };
    const replacement = { ...card, id: "replacement", foilAvailable: true };
    expect(replaceHistoryCard(foil, replacement).card).toEqual({ ...replacement, assumedFoil: true });
    expect(replaceHistoryCard(foil, { ...replacement, foilAvailable: false }).card.assumedFoil).toBeUndefined();
    expect(replaceHistoryCard(entry, replacement).card.assumedFoil).toBeUndefined();
  });

  it("removes selected occurrences without deleting duplicate printings", () => {
    const duplicate = { ...entry, id: "duplicate" };
    const other = { ...entry, id: "other", card: { ...card, id: "other-card" } };
    const entries = [entry, duplicate, other];

    expect(removeHistoryEntries(entries, [entry.id, other.id])).toEqual([duplicate]);
    expect(removeHistoryEntries(entries, [])).toEqual(entries);
    expect(removeHistoryEntries(entries, entries.map(({ id }) => id))).toEqual([]);
  });

  it("counts duplicate printings, finish fallback and unpriced entries without mixing currencies", () => {
    const entries = [entry, { ...entry, id: "duplicate" }, { ...entry, id: "missing", card: { ...card, prices: {} } }];
    expect(summarizeHistory(entries, "usd")).toEqual({ text: "$2.50", count: 3, missing: 1, fallback: 0 });
    expect(summarizeHistory(entries, "eur")).toEqual({ text: "€5.00", count: 3, missing: 1, fallback: 2 });
    expect(summarizeHistory(entries, "tix")).toEqual({ text: "0.00 TIX", count: 3, missing: 3, fallback: 0 });
  });

  it("sums mixed scans using each assumed finish and counts missing foil prices as fallbacks", () => {
    const prices = { usd: "1.00", usd_foil: "5.00", eur: "2.00", eur_foil: null, tix: "0.10" };
    const normal = { ...entry, card: { ...card, prices } };
    const foil = { ...entry, id: "foil", card: { ...card, prices, foilAvailable: true, assumedFoil: true } };
    expect(summarizeHistory([normal, foil], "usd")).toEqual({ text: "$6.00", count: 2, missing: 0, fallback: 0 });
    expect(summarizeHistory([normal, foil], "eur")).toEqual({ text: "€4.00", count: 2, missing: 0, fallback: 1 });
    expect(summarizeHistory([normal, foil], "tix")).toEqual({ text: "0.20 TIX", count: 2, missing: 0, fallback: 0 });
  });

  it("selects the highest priced card using the selected currency and assumed finish", () => {
    const normal = { ...entry, card: { ...card, prices: { usd: "3.00", eur: "8.00" } } };
    const foil = { ...entry, id: "foil", card: { ...card, id: "foil", assumedFoil: true, prices: { usd: "1.00", usd_foil: "5.00", eur: "2.00" } } };
    const missing = { ...entry, id: "missing", card: { ...card, prices: { usd: "invalid" } } };
    expect(highestValueCard([missing, normal, foil], "usd")).toEqual(foil.card);
    expect(highestValueCard([missing, normal, foil], "eur")).toEqual(normal.card);
    expect(highestValueCard([missing], "usd")).toBeNull();
    expect(highestValueCard([], "usd")).toBeNull();
    expect(highestValueCard([normal, foil], "tix")).toBeNull();
  });
});
