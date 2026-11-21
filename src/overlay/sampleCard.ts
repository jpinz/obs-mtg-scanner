import type { CardInfo } from "../scryfall";

/** Placeholder shown while editing the layout so every enabled component is visible without a scanned card. */
export const SAMPLE_CARD: CardInfo = Object.freeze({
  id: "sample",
  name: "Sample Card",
  setName: "Sample Set",
  setCode: "SMP",
  collectorNumber: "001",
  rarity: "rare",
  imageUrl: null,
  prices: Object.freeze({ usd: "1.23", usd_foil: "2.46", eur: "1.15", eur_foil: "2.30", tix: "0.05" }),
  scryfallUri: "",
});

/** Ghost card in the canvas center that the sample follow panel is placed beside. */
export const SAMPLE_CORNERS: readonly (readonly [number, number])[] = Object.freeze([
  [0.4, 0.25],
  [0.6, 0.25],
  [0.6, 0.75],
  [0.4, 0.75],
] as const);
