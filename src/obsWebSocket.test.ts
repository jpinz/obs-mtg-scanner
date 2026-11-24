import { describe, expect, it } from "vitest";
import {
  MASKED_OBS_PASSWORD,
  parseObsConnectionSettings,
  parseObsOverlayEvent,
  serializeObsConnectionSettings,
} from "./obsWebSocket";

describe("OBS connection URL settings", () => {
  it("omits the default port and accepts URLs with or without it", () => {
    const fragment = serializeObsConnectionSettings({ port: 4455, password: "example" });
    expect(fragment).toBe("");
    expect(parseObsConnectionSettings(fragment).port).toBe(4455);
    expect(parseObsConnectionSettings("#obsPort=4455").port).toBe(4455);
  });

  describe("OBS card events", () => {
    it("validates one-shot celebrations with bundled and custom sounds", () => {
      const event = { type: "celebration", sessionId: "session", id: "unique-id", sound: null } as const;
      const wire = { source: "obs-mtg-scanner", ...event };
      expect(parseObsOverlayEvent(wire)).toEqual(event);
      expect(parseObsOverlayEvent({ ...wire, sound: "party-horn" })).toEqual({ ...event, sound: "party-horn" });
      expect(parseObsOverlayEvent({ ...wire, sound: "data:audio/wav;base64,UklGRg==" })).toEqual({
        ...event, sound: "data:audio/wav;base64,UklGRg==",
      });
      for (const invalid of [{ id: "" }, { id: 1 }, { sound: undefined }, { sound: "javascript:alert(1)" }]) {
        expect(parseObsOverlayEvent({ ...wire, ...invalid })).toBeNull();
      }
    });
    it("validates total events before displaying them", () => {
      const event = { source: "obs-mtg-scanner", type: "total", sessionId: "session", text: "$12.00", count: 3, missing: 1 };
      expect(parseObsOverlayEvent(event)).toEqual({ type: "total", sessionId: "session", text: "$12.00", count: 3, missing: 1 });
      expect(parseObsOverlayEvent({ ...event, missing: 4 })).toBeNull();
      expect(parseObsOverlayEvent({ ...event, count: -1 })).toBeNull();
    });
    it("validates highest value card updates and empty batches", () => {
      const event = { source: "obs-mtg-scanner", type: "highest", sessionId: "session", card: null };
      expect(parseObsOverlayEvent(event)).toEqual({ type: "highest", sessionId: "session", card: null });
      expect(parseObsOverlayEvent({ ...event, card: { id: "bad" } })).toBeNull();
      const card = {
        id: "card-id", name: "Card", setName: "Set", setCode: "SET", collectorNumber: "1",
        rarity: "rare", imageUrl: null, prices: { usd: "5.00" }, scryfallUri: "https://scryfall.com/card/set/1",
      };
      expect(parseObsOverlayEvent({ ...event, card })).toEqual({ type: "highest", sessionId: "session", card });
    });
    it("parses confidence scores and treats legacy events without a score as unavailable", () => {
      const card = {
        id: "card-id",
        name: "Card",
        setName: "Set",
        setCode: "SET",
        collectorNumber: "1",
        rarity: "rare",
        imageUrl: null,
        prices: {},
        scryfallUri: "https://scryfall.com/card/set/1",
      };
      const base = { source: "obs-mtg-scanner", type: "card", sessionId: "session", card };
      expect(parseObsOverlayEvent({ ...base, confidence: 0.876 })).toEqual({
        type: "card",
        sessionId: "session",
        card,
        confidence: 0.876,
      });
      expect(parseObsOverlayEvent(base)).toEqual({
        type: "card",
        sessionId: "session",
        card,
        confidence: null,
      });
      const foilCard = { ...card, foilAvailable: true, assumedFoil: true };
      expect(parseObsOverlayEvent({ ...base, card: foilCard })).toEqual({
        type: "card",
        sessionId: "session",
        card: foilCard,
        confidence: null,
      });
      expect(parseObsOverlayEvent({ ...base, card: { ...foilCard, assumedFoil: "yes" } })).toBeNull();
      expect(parseObsOverlayEvent({ ...base, confidence: 1.1 })).toBeNull();
      expect(parseObsOverlayEvent({ ...base, card: null, confidence: 0.876 })).toBeNull();
    });
  });

  it("preserves a custom port without including the password", () => {
    const fragment = serializeObsConnectionSettings({ port: 4456, password: "example" });
    expect(fragment).toBe("obsPort=4456");
    expect(parseObsConnectionSettings(`#${fragment}`)).toEqual({ port: 4456, password: "" });
  });

  it("uses an encoded fragment password instead of the saved password", () => {
    const password = "example+&=# %";
    const fragment = new URLSearchParams({ obsPassword: password }).toString();
    expect(parseObsConnectionSettings(`#${fragment}`, "saved-example")).toEqual({ port: 4455, password });
  });

  it("uses the saved password only when the fragment password is absent", () => {
    expect(parseObsConnectionSettings("", "saved-example").password).toBe("saved-example");
    expect(parseObsConnectionSettings("#obsPassword=", "saved-example").password).toBe("");
  });

  it("includes an encoded password that round-trips, or masks it for display", () => {
    const settings = { port: 4456, password: "example+&=# %" };
    const fragment = serializeObsConnectionSettings(settings, { password: "include" });
    expect(parseObsConnectionSettings(`#${fragment}`)).toEqual(settings);

    const masked = serializeObsConnectionSettings(settings, { password: "mask" });
    expect(masked).toBe(`obsPort=4456&obsPassword=${MASKED_OBS_PASSWORD}`);
    expect(serializeObsConnectionSettings({ port: 4455, password: "x" }, { password: "mask" })).toBe(
      `obsPassword=${MASKED_OBS_PASSWORD}`,
    );
    expect(serializeObsConnectionSettings({ port: 4455, password: "" }, { password: "mask" })).toBe("");
  });
});
