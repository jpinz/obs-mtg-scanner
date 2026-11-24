import { describe, expect, it, vi } from "vitest";
import { formatFinishPrices, formatPrice, parseCard, ScryfallClient } from "./scryfall";
import type { CardInfo } from "./scryfall";

function cardJson(overrides: Record<string, unknown> = {}) {
  return {
    id: "card-id",
    name: "Example Card",
    set_name: "Example Set",
    set: "abc",
    collector_number: "12",
    rarity: "rare",
    image_uris: { normal: "https://example.test/card.jpg" },
    prices: { usd: "1.2", usd_foil: "2.5", tix: "0.05" },
    scryfall_uri: "https://scryfall.com/card/abc/12",
    ...overrides,
  };
}

function response(json: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => json,
  } as Response;
}

function cardWithPrices(prices: CardInfo["prices"]): CardInfo {
  return parseCard(cardJson({ prices }));
}

describe("parseCard", () => {
  it("parses a normal card", () => {
    expect(parseCard(cardJson())).toMatchObject({
      id: "card-id",
      name: "Example Card",
      setName: "Example Set",
      setCode: "ABC",
      collectorNumber: "12",
      rarity: "rare",
      imageUrl: "https://example.test/card.jpg",
    });
  });

  it("gets a double-faced card image from its first face", () => {
    expect(parseCard(cardJson({
      name: "Delver of Secrets // Insectile Aberration",
      image_uris: undefined,
      card_faces: [{ image_uris: { normal: "https://example.test/front.jpg" } }],
    })).imageUrl).toBe("https://example.test/front.jpg");
  });
});

describe("formatPrice", () => {
  it("formats the requested price and falls back to foil", () => {
    expect(formatPrice(cardWithPrices({ usd: "1.2" }), "usd")).toEqual({ text: "$1.20", currency: "usd" });
    expect(formatPrice(cardWithPrices({ usd: null, usd_foil: "2.5" }), "usd")).toEqual({ text: "$2.50", currency: "usd_foil" });
  });

  describe("formatFinishPrices", () => {
    it("shows each available USD finish without fallback or duplication", () => {
      const card = cardWithPrices({ usd: "1.2", usd_foil: "2.5", usd_etched: "3.75", eur: "9" });
      expect(formatFinishPrices(card, "usd_foil")).toEqual([
        { text: "$1.20", currency: "usd" },
        { text: "$2.50", currency: "usd_foil" },
        { text: "$3.75", currency: "usd_etched" },
      ]);
    });

    it("omits missing and invalid prices and keeps currencies separate", () => {
      const card = cardWithPrices({ usd: null, usd_foil: "bad", usd_etched: "0", eur: "", eur_foil: "1.25", tix: "0.05" });
      expect(formatFinishPrices(card, "usd")).toEqual([{ text: "$0.00", currency: "usd_etched" }]);
      expect(formatFinishPrices(card, "eur_foil")).toEqual([{ text: "€1.25", currency: "eur_foil" }]);
      expect(formatFinishPrices(card, "tix")).toEqual([{ text: "0.05 TIX", currency: "tix" }]);
      expect(formatFinishPrices(cardWithPrices({}), "usd")).toEqual([]);
    });
  });

  it("formats tix and returns null when no usable price exists", () => {
    expect(formatPrice(cardWithPrices({ tix: "0.05" }), "tix")).toEqual({ text: "0.05 TIX", currency: "tix" });
    expect(formatPrice(cardWithPrices({ eur: "bad" }), "usd")).toBeNull();
  });
});

describe("ScryfallClient", () => {
  it("searches and paginates individual printings by escaped card name", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ data: [cardJson()], has_more: true }));
    const client = new ScryfallClient({ fetch: fetcher, minIntervalMs: 0 });
    await expect(client.searchPrintings('Fire "Ice"', 2)).resolves.toMatchObject({ cards: [{ id: "card-id" }], hasMore: true });
    const params = new URL(String(fetcher.mock.calls[0]![0])).searchParams;
    expect(params.get("q")).toBe('name:"Fire \\"Ice\\""');
    expect(params.get("page")).toBe("2");
    expect(params.get("unique")).toBe("prints");
  });
  it("caches completed cards and deduplicates concurrent requests", async () => {
    let completeRequest: ((value: Response) => void) | undefined;
    const fetcher = vi.fn(() => new Promise<Response>((resolve) => { completeRequest = resolve; }));
    const client = new ScryfallClient({ fetch: fetcher, minIntervalMs: 0 });

    const first = client.getCard("card-id");
    const concurrent = client.getCard("card-id");
    expect(concurrent).toBe(first);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    completeRequest?.(response(cardJson()));
    await expect(first).resolves.toMatchObject({ card: { id: "card-id" } });
    await client.getCard("card-id");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not cache failures and includes the response status in errors", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ details: "Not found" }, false, 404))
      .mockResolvedValueOnce(response(cardJson()));
    const client = new ScryfallClient({ fetch: fetcher, minIntervalMs: 0 });

    await expect(client.getCard("card-id")).rejects.toThrow("status 404: Not found");
    await expect(client.getCard("card-id")).resolves.toMatchObject({ card: { id: "card-id" } });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each([
    {
      name: "art series",
      data: { layout: "art_series", legalities: { vintage: "not_legal" } },
      expected: { isArtCard: true, isTokenCard: false, isNonPlayable: true },
    },
    {
      name: "token",
      data: { layout: "token", legalities: { vintage: "not_legal" } },
      expected: { isArtCard: false, isTokenCard: true, isNonPlayable: true },
    },
    {
      name: "double-faced token",
      data: { layout: "double_faced_token", legalities: { vintage: "not_legal" } },
      expected: { isArtCard: false, isTokenCard: true, isNonPlayable: true },
    },
    {
      name: "reversible token",
      data: { layout: "reversible_card", card_faces: [{ layout: "token" }, { layout: "token" }] },
      expected: { isArtCard: false, isTokenCard: true, isNonPlayable: false },
    },
    {
      name: "non-playable Rule 104.3a",
      data: { name: "Rule 104.3a", layout: "planar", promo: false, legalities: { vintage: "not_legal", commander: "banned" } },
      expected: { isArtCard: false, isTokenCard: false, isNonPlayable: true },
    },
    {
      name: "playable promo",
      data: { layout: "normal", promo: true, legalities: { vintage: "restricted", commander: "not_legal" } },
      expected: { isArtCard: false, isTokenCard: false, isNonPlayable: false },
    },
    {
      name: "missing legality",
      data: { layout: "normal" },
      expected: { isArtCard: false, isTokenCard: false, isNonPlayable: false },
    },
    {
      name: "unknown legality",
      data: { layout: "normal", legalities: { vintage: "not_legal", other: "unknown" } },
      expected: { isArtCard: false, isTokenCard: false, isNonPlayable: false },
    },
  ])("classifies a scanned $name without altering the display card", async ({ data, expected }) => {
    const fetcher = vi.fn().mockResolvedValue(response(cardJson(data)));
    const client = new ScryfallClient({ fetch: fetcher, minIntervalMs: 0 });
    await expect(client.getCard("card-id")).resolves.toMatchObject({ card: { id: "card-id" }, ...expected });
  });

  it("waits between starts of distinct requests", async () => {
    let clock = 0;
    const sleep = vi.fn(async (ms: number) => { clock += ms; });
    const fetcher = vi.fn(async () => response(cardJson()));
    const client = new ScryfallClient({ fetch: fetcher, minIntervalMs: 100, now: () => clock, sleep });

    await client.getCard("first");
    await client.getCard("second");
    expect(sleep).toHaveBeenCalledWith(100);
  });

  it("loads all print IDs from multiple sets across pages and respects the search rate limit", async () => {
    let clock = 0;
    const sleep = vi.fn(async (ms: number) => { clock += ms; });
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({ data: [{ id: "woe-card" }], has_more: true }))
      .mockResolvedValueOnce(response({ data: [{ id: "mom-card" }, { id: "woe-card" }], has_more: false }));
    const client = new ScryfallClient({ fetch: fetcher, minIntervalMs: 0, now: () => clock, sleep });

    await expect(client.searchCardIds("", ["woe", "mom"])).resolves.toEqual(["woe-card", "mom-card"]);
    const firstUrl = new URL(String(fetcher.mock.calls[0]![0]));
    expect(firstUrl.pathname).toBe("/cards/search");
    expect(firstUrl.searchParams.get("q")).toBe("(set:woe OR set:mom)");
    expect(firstUrl.searchParams.get("unique")).toBe("prints");
    expect(firstUrl.searchParams.get("include_extras")).toBe("true");
    expect(firstUrl.searchParams.get("include_variations")).toBe("true");
    expect(new URL(String(fetcher.mock.calls[1]![0])).searchParams.get("page")).toBe("2");
    expect(sleep).toHaveBeenCalledWith(500);
  });

  it("uses a Scryfall query alone or intersects it with the selected sets", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ data: [{ id: "card-id" }], has_more: false }));
    const client = new ScryfallClient({ fetch: fetcher, minIntervalMs: 0, sleep: async () => {} });
    const query = 't:creature OR name:"Fire & Ice"';

    await client.searchCardIds(query);
    expect(new URL(String(fetcher.mock.calls[0]![0])).searchParams.get("q"))
      .toBe('(t:creature OR name:"Fire & Ice")');
    await client.searchCardIds(query, ["woe", "mom"]);
    expect(new URL(String(fetcher.mock.calls[1]![0])).searchParams.get("q"))
      .toBe('(set:woe OR set:mom) AND (t:creature OR name:"Fire & Ice")');
  });

  it("rejects empty filters and invalid set codes without making a request", async () => {
    const fetcher = vi.fn();
    const client = new ScryfallClient({ fetch: fetcher });
    await expect(client.searchCardIds(" ")).rejects.toThrow("set code or Scryfall query");
    await expect(client.searchCardIds("", ["woe OR set:mom"])).rejects.toThrow("Set codes");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("surfaces Scryfall search failures", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ details: "No cards found" }, false, 404));
    const client = new ScryfallClient({ fetch: fetcher, minIntervalMs: 0 });
    await expect(client.searchCardIds("", ["unknown"])).rejects.toThrow("status 404: No cards found");
  });

  it.each([
    { data: [], has_more: false },
    { data: [{ id: "" }], has_more: false },
    { data: [{ id: "card-id" }] },
  ])("rejects an invalid card search response: %j", async (json) => {
    const fetcher = vi.fn().mockResolvedValue(response(json));
    const client = new ScryfallClient({ fetch: fetcher, minIntervalMs: 0 });
    await expect(client.searchCardIds("", ["woe"])).rejects.toThrow("Invalid Scryfall card search");
  });
});



