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
    it("validates total events before displaying them", () => {
      const event = { source: "obs-mtg-scanner", type: "total", sessionId: "session", text: "$12.00", count: 3, missing: 1 };
      expect(parseObsOverlayEvent(event)).toEqual({ type: "total", sessionId: "session", text: "$12.00", count: 3, missing: 1 });
      expect(parseObsOverlayEvent({ ...event, missing: 4 })).toBeNull();
      expect(parseObsOverlayEvent({ ...event, count: -1 })).toBeNull();
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
