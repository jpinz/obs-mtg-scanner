import { describe, expect, it } from "vitest";
import type { CardInfo } from "../scryfall";
import { parseHistory, summarizeHistory, type HistoryEntry } from "./history";

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

  it("counts duplicate printings, finish fallback and unpriced entries without mixing currencies", () => {
    const entries = [entry, { ...entry, id: "duplicate" }, { ...entry, id: "missing", card: { ...card, prices: {} } }];
    expect(summarizeHistory(entries, "usd")).toEqual({ text: "$2.50", count: 3, missing: 1, fallback: 0 });
    expect(summarizeHistory(entries, "eur")).toEqual({ text: "€5.00", count: 3, missing: 1, fallback: 2 });
    expect(summarizeHistory(entries, "tix")).toEqual({ text: "0.00 TIX", count: 3, missing: 3, fallback: 0 });
  });
});
