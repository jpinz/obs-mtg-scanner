import { describe, expect, it, vi } from "vitest";
import { formatPrice, parseCard, ScryfallClient } from "./scryfall";
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

  it("formats tix and returns null when no usable price exists", () => {
    expect(formatPrice(cardWithPrices({ tix: "0.05" }), "tix")).toEqual({ text: "0.05 TIX", currency: "tix" });
    expect(formatPrice(cardWithPrices({ eur: "bad" }), "usd")).toBeNull();
  });
});

describe("ScryfallClient", () => {
  it("caches completed cards and deduplicates concurrent requests", async () => {
    let completeRequest: ((value: Response) => void) | undefined;
    const fetcher = vi.fn(() => new Promise<Response>((resolve) => { completeRequest = resolve; }));
    const client = new ScryfallClient({ fetch: fetcher, minIntervalMs: 0 });

    const first = client.getCard("card-id");
    const concurrent = client.getCard("card-id");
    expect(concurrent).toBe(first);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    completeRequest?.(response(cardJson()));
    await expect(first).resolves.toMatchObject({ id: "card-id" });
    await client.getCard("card-id");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not cache failures and includes the response status in errors", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ details: "Not found" }, false, 404))
      .mockResolvedValueOnce(response(cardJson()));
    const client = new ScryfallClient({ fetch: fetcher, minIntervalMs: 0 });

    await expect(client.getCard("card-id")).rejects.toThrow("status 404: Not found");
    await expect(client.getCard("card-id")).resolves.toMatchObject({ id: "card-id" });
    expect(fetcher).toHaveBeenCalledTimes(2);
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
});



