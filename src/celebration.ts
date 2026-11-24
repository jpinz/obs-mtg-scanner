import { formatPrice, type CardInfo } from "./scryfall";
import type { OverlaySettings } from "./settings";

export const DEFAULT_CELEBRATION_SOUND = "/audio/tada_fanfare.mp3";
export const PARTY_HORN_SOUND = "/audio/birthday_party_horn.mp3";
export const MAX_SOUND_BYTES = 256 * 1024;
export const SOUND_STORAGE_KEY = "mtg-scanner:celebration-sound";
export const SOUND_CHOICE_STORAGE_KEY = "mtg-scanner:celebration-sound-choice";

export type CelebrationSoundChoice = "tada" | "party-horn" | "custom";

export interface CustomSound {
  name: string;
  data: string;
}

function isCustomSound(value: unknown): value is string {
  return typeof value === "string"
    && value.length <= Math.ceil(MAX_SOUND_BYTES / 3) * 4 + 64
    && /^data:audio\/(?:mpeg|mp3|wav|wave|x-wav);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}

export function isCelebrationSound(value: unknown): value is string {
  return value === "party-horn" || isCustomSound(value);
}

export function soundForEvent(choice: CelebrationSoundChoice, custom: CustomSound | null): string | null {
  if (choice === "party-horn") return "party-horn";
  return choice === "custom" ? custom?.data ?? null : null;
}

export function soundSource(sound: string | null): string {
  if (sound === "party-horn") return PARTY_HORN_SOUND;
  return sound ?? DEFAULT_CELEBRATION_SOUND;
}

export function loadSoundChoice(custom: CustomSound | null): CelebrationSoundChoice {
  try {
    const choice = localStorage.getItem(SOUND_CHOICE_STORAGE_KEY);
    if (choice === "tada" || choice === "party-horn" || (choice === "custom" && custom)) return choice;
  } catch {
    // Keep using the saved custom sound for this session when storage is unavailable.
  }
  return custom ? "custom" : "tada";
}

export function shouldCelebrate(card: CardInfo, settings: OverlaySettings): boolean {
  if (!settings.celebrationEnabled) return false;
  const price = formatPrice(card, settings.currency);
  if (!price) return false;
  const amount = Number(card.prices[price.currency]);
  return amount >= 0 && amount >= settings.celebrationThreshold;
}

export function loadCustomSound(): CustomSound | null {
  try {
    const sound: unknown = JSON.parse(localStorage.getItem(SOUND_STORAGE_KEY) ?? "null");
    if (typeof sound !== "object" || sound === null) return null;
    const { name, data } = sound as Partial<CustomSound>;
    return typeof name === "string" && isCustomSound(data) ? { name, data } : null;
  } catch {
    return null;
  }
}
