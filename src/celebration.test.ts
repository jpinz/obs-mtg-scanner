import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_CELEBRATION_SOUND,
  PARTY_HORN_SOUND,
  isCelebrationSound,
  loadCustomSound,
  loadSoundChoice,
  MAX_SOUND_BYTES,
  shouldCelebrate,
  soundForEvent,
  soundSource,
} from "./celebration";
import { DEFAULT_SETTINGS } from "./settings";
import { SAMPLE_CARD } from "./overlay/sampleCard";

describe("valuable card celebrations", () => {
  const settings = { ...DEFAULT_SETTINGS, celebrationEnabled: true, celebrationThreshold: 20 };

  it("celebrates at or above the threshold, but not below it or when disabled", () => {
    for (const [price, expected] of [["19.99", false], ["20.00", true], ["20.01", true]] as const) {
      const card = { ...SAMPLE_CARD, prices: { usd: price } };
      expect(shouldCelebrate(card, settings)).toBe(expected);
      expect(shouldCelebrate(card, { ...settings, celebrationEnabled: false })).toBe(false);
    }
  });

  it("uses only the selected currency and the panel's finish fallback", () => {
    const card = { ...SAMPLE_CARD, prices: { usd: "10", usd_foil: "30", eur: "25", tix: "5" } };
    expect(shouldCelebrate(card, settings)).toBe(false);
    expect(shouldCelebrate(card, { ...settings, currency: "usd_foil" })).toBe(true);
    expect(shouldCelebrate(card, { ...settings, currency: "eur_foil" })).toBe(true);
    expect(shouldCelebrate(card, { ...settings, currency: "tix" })).toBe(false);
    expect(shouldCelebrate({ ...card, prices: { usd_etched: "30" } }, settings)).toBe(true);
    expect(shouldCelebrate({ ...card, prices: { usd: "100" } }, { ...settings, currency: "eur" })).toBe(false);
  });

  it("ignores absent, invalid and negative prices, including at a zero threshold", () => {
    for (const price of [null, "", " ", "NaN", "Infinity", "-1"]) {
      expect(shouldCelebrate({ ...SAMPLE_CARD, prices: { usd: price } }, { ...settings, celebrationThreshold: 0 })).toBe(false);
    }
    expect(shouldCelebrate({ ...SAMPLE_CARD, prices: { usd: "0" } }, { ...settings, celebrationThreshold: 0 })).toBe(true);
  });
});

describe("custom celebration sounds", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the chosen bundled or custom sound in the scanner and overlay", () => {
    const custom = { name: "custom.wav", data: "data:audio/wav;base64,UklGRg==" };
    expect(soundSource(soundForEvent("tada", custom))).toBe(DEFAULT_CELEBRATION_SOUND);
    expect(soundSource(soundForEvent("party-horn", custom))).toBe(PARTY_HORN_SOUND);
    expect(soundSource(soundForEvent("custom", custom))).toBe(custom.data);
    expect(soundSource(soundForEvent("custom", null))).toBe(DEFAULT_CELEBRATION_SOUND);
  });

  it("preserves previously uploaded sounds and honors a saved built-in choice", () => {
    const custom = { name: "custom.wav", data: "data:audio/wav;base64,UklGRg==" };
    const getItem = vi.fn<(key: string) => string | null>(() => null);
    vi.stubGlobal("localStorage", { getItem });
    expect(loadSoundChoice(null)).toBe("tada");
    expect(loadSoundChoice(custom)).toBe("custom");
    getItem.mockReturnValue("party-horn");
    expect(loadSoundChoice(custom)).toBe("party-horn");
    getItem.mockReturnValue("tada");
    expect(loadSoundChoice(custom)).toBe("tada");
    getItem.mockReturnValue("custom");
    expect(loadSoundChoice(null)).toBe("tada");
    getItem.mockReturnValue(JSON.stringify({ name: "invalid", data: "party-horn" }));
    expect(loadCustomSound()).toBeNull();
  });

  it("accepts bounded MP3/WAV data but not remote URLs or other data types", () => {
    expect(isCelebrationSound("data:audio/mpeg;base64,SUQz")).toBe(true);
    expect(isCelebrationSound("data:audio/wav;base64,UklGRg==")).toBe(true);
    for (const sound of [null, "", "https://example.com/sound.mp3", "data:text/html;base64,SUQz", "data:audio/wav;base64,!!!"]) {
      expect(isCelebrationSound(sound)).toBe(false);
    }
    expect(isCelebrationSound(`data:audio/wav;base64,${"A".repeat(MAX_SOUND_BYTES * 2)}`)).toBe(false);
  });
});
