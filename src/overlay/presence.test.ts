import { describe, expect, it } from "vitest";
import { PresenceTracker } from "./presence";

describe("PresenceTracker", () => {
  it("reports card changes and ignores repeats", () => {
    const tracker = new PresenceTracker(1000);
    expect(tracker.show("a", 0)).toBe(true);
    expect(tracker.show("a", 10)).toBe(false);
    expect(tracker.show("b", 20)).toBe(true);
  });

  it("expires once after the card has been absent for the duration", () => {
    const tracker = new PresenceTracker(1000);
    tracker.show("a", 0);
    tracker.observe(true, 800);
    expect(tracker.expire(1500)).toBe(false);
    tracker.observe(false, 1600);
    expect(tracker.expire(1800)).toBe(true);
    expect(tracker.expire(1900)).toBe(false);
    expect(tracker.cardId).toBeNull();
    expect(tracker.show("a", 2000)).toBe(true);
  });

  it("never expires with a zero duration", () => {
    const tracker = new PresenceTracker(0);
    tracker.show("a", 0);
    expect(tracker.expire(1_000_000)).toBe(false);
  });
});
