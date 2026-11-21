import { describe, expect, it, vi } from "vitest";
import type { CardInfo } from "../scryfall";
import { CardFeed } from "./cardFeed";

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

describe("CardFeed", () => {
  it("aborts stale lookups and only publishes the latest detected card", async () => {
    const requests: { signal: AbortSignal; resolve(card: CardInfo): void }[] = [];
    const publish = vi.fn();
    const feed = new CardFeed(
      {
        lookup: (_id, signal) =>
          new Promise((resolve) => requests.push({ signal, resolve })),
        publish,
        onError: vi.fn(),
      },
      1000,
    );

    const first = feed.detected("first", 0, 0.62);
    const second = feed.detected("second", 1, 0.91);
    requests[0].resolve({ ...card, id: "first" });
    requests[1].resolve({ ...card, id: "second" });
    await Promise.all([first, second]);

    expect(requests[0].signal.aborted).toBe(true);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith({ ...card, id: "second" }, 0.91);
  });

  it("hides the panel once the absent-card duration elapses", async () => {
    const publish = vi.fn();
    const feed = new CardFeed(
      {
        lookup: vi.fn(async () => card),
        publish,
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
});
