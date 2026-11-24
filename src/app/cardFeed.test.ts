import { describe, expect, it, vi } from "vitest";
import { ScryfallClient, type CardInfo, type ScannedCard } from "../scryfall";
import { DEFAULT_SETTINGS } from "../settings";
import { CardFeed, isIgnoredCard } from "./cardFeed";

const card: CardInfo = {
  id: "print-1",
  name: "Card",
  setName: "Set",
  setCode: "set",
  collectorNumber: "1",
  rarity: "rare",
  imageUrl: null,
  prices: {},
  scryfallUri: "https://scryfall.com/card/set/1",
};

function scanned(overrides: Partial<ScannedCard> = {}): ScannedCard {
  return { card, isArtCard: false, isTokenCard: false, isNonPlayable: false, ...overrides };
}

describe("CardFeed", () => {
  it("aborts stale lookups and only publishes the latest detected card", async () => {
    const requests: { signal: AbortSignal; resolve(card: ScannedCard): void }[] = [];
    const publish = vi.fn();
    const feed = new CardFeed(
      {
        lookup: (_id, signal) =>
          new Promise((resolve) => requests.push({ signal, resolve })),
        shouldIgnore: () => false,
        publish,
        onNewCard: vi.fn(),
        onError: vi.fn(),
      },
      1000,
    );

    const first = feed.detected("first", 0, 0.62);
    const second = feed.detected("second", 1, 0.91);
    requests[0].resolve(scanned({ card: { ...card, id: "first" } }));
    requests[1].resolve(scanned({ card: { ...card, id: "second" } }));
    await Promise.all([first, second]);

    expect(requests[0].signal.aborted).toBe(true);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith({ ...card, id: "second" }, 0.91);
  });

  it("hides the panel once the absent-card duration elapses", async () => {
    const publish = vi.fn();
    const feed = new CardFeed(
      {
        lookup: vi.fn(async () => scanned()),
        shouldIgnore: () => false,
        publish,
        onNewCard: vi.fn(),
        onError: vi.fn(),
      },
      1000,
    );

    await feed.detected(card.id, 0);
    feed.tick(999);
    feed.tick(1000);
    feed.tick(1001);

    expect(publish.mock.calls).toEqual([[card, null], [null, null]]);
  });

  it("applies art, token, and no-legal-format rules independently", () => {
    const art = scanned({ isArtCard: true, isNonPlayable: true });
    const token = scanned({ isTokenCard: true, isNonPlayable: true });
    const nonPlayable = scanned({ isNonPlayable: true });
    const artOnly = { ...DEFAULT_SETTINGS, ignoreArtCards: true };
    const tokensOnly = { ...DEFAULT_SETTINGS, ignoreTokenCards: true };
    const noLegalFormat = { ...DEFAULT_SETTINGS, ignoreNonPlayableCards: true };

    expect(isIgnoredCard(art, artOnly)).toBe(true);
    expect(isIgnoredCard(token, artOnly)).toBe(false);
    expect(isIgnoredCard(token, tokensOnly)).toBe(true);
    expect(isIgnoredCard(art, tokensOnly)).toBe(false);
    expect(isIgnoredCard(nonPlayable, artOnly)).toBe(false);
    expect([art, token, nonPlayable].every((item) => isIgnoredCard(item, noLegalFormat))).toBe(true);
    expect(isIgnoredCard(scanned(), noLegalFormat)).toBe(false);
  });

  it("suppresses ignored cards from the overlay, tracking, and automatic history", async () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      ignoreArtCards: true,
      ignoreTokenCards: true,
      ignoreNonPlayableCards: true,
    };
    const cards: Record<string, unknown> = {
      normal: { id: "normal", name: "Playable promo", layout: "normal", promo: true, legalities: { vintage: "restricted" } },
      art: { id: "art", name: "Art", layout: "art_series", legalities: { vintage: "not_legal" } },
      token: { id: "token", name: "Token", layout: "token", legalities: { vintage: "not_legal" } },
      rule: { id: "rule", name: "Rule 104.3a", layout: "planar", legalities: { vintage: "not_legal" } },
    };
    const fetcher = vi.fn<typeof fetch>(async (url) => {
      const id = new URL(String(url)).pathname.split("/").at(-1)!;
      return { ok: true, json: async () => cards[id] } as Response;
    });
    const client = new ScryfallClient({ fetch: fetcher, minIntervalMs: 0 });
    const publish = vi.fn();
    const onNewCard = vi.fn();
    const feed = new CardFeed({
      lookup: (id, signal) => client.getCard(id, signal),
      shouldIgnore: (result) => isIgnoredCard(result, settings),
      publish,
      onNewCard,
      onError: vi.fn(),
    }, 1000);

    await feed.detected("normal", 0, 0.9);
    expect(feed.cardId).toBe("normal");
    await feed.detected("art", 1, 0.8);
    expect(feed.cardId).toBeNull();
    await feed.detected("token", 2);
    await feed.detected("rule", 3);

    expect(publish.mock.calls).toEqual([[expect.objectContaining({ id: "normal", name: "Playable promo" }), 0.9], [null, null]]);
    expect(onNewCard).toHaveBeenCalledTimes(1);
    expect(onNewCard).toHaveBeenCalledWith(expect.objectContaining({ id: "normal", name: "Playable promo" }));
    expect(feed.cardId).toBeNull();
  });

  it("applies changed ignore settings immediately without duplicating history", async () => {
    const settings = { ...DEFAULT_SETTINGS, ignoreArtCards: true };
    const art = scanned({ isArtCard: true, isNonPlayable: true });
    const publish = vi.fn();
    const onNewCard = vi.fn();
    const feed = new CardFeed({
      lookup: async () => art,
      shouldIgnore: (result) => isIgnoredCard(result, settings),
      publish,
      onNewCard,
      onError: vi.fn(),
    }, 1000);

    await feed.detected(card.id, 0, 0.8);
    expect(publish).not.toHaveBeenCalled();
    expect(onNewCard).not.toHaveBeenCalled();

    settings.ignoreArtCards = false;
    feed.refreshIgnoreRules();
    expect(publish).toHaveBeenLastCalledWith(card, 0.8);
    expect(feed.cardId).toBe(card.id);
    expect(onNewCard).toHaveBeenCalledOnce();

    settings.ignoreArtCards = true;
    feed.refreshIgnoreRules();
    expect(publish).toHaveBeenLastCalledWith(null, null);
    expect(feed.cardId).toBeNull();
    settings.ignoreArtCards = false;
    feed.refreshIgnoreRules();
    expect(publish).toHaveBeenLastCalledWith(card, 0.8);
    expect(onNewCard).toHaveBeenCalledOnce();
  });

  it("uses the latest ignore settings when a lookup finishes", async () => {
    const settings = { ...DEFAULT_SETTINGS, ignoreTokenCards: false };
    let finish!: (value: ScannedCard) => void;
    const publish = vi.fn();
    const onNewCard = vi.fn();
    const feed = new CardFeed({
      lookup: () => new Promise((resolve) => { finish = resolve; }),
      shouldIgnore: (result) => isIgnoredCard(result, settings),
      publish,
      onNewCard,
      onError: vi.fn(),
    }, 1000);

    const pending = feed.detected(card.id, 0);
    settings.ignoreTokenCards = true;
    feed.refreshIgnoreRules();
    finish(scanned({ isTokenCard: true }));
    await pending;

    expect(publish).not.toHaveBeenCalled();
    expect(onNewCard).not.toHaveBeenCalled();
    expect(feed.cardId).toBeNull();
  });
});
