import { CURRENCIES, type Currency } from "./settings";

export interface CardInfo {
  id: string;
  name: string;
  setName: string;
  setCode: string;
  collectorNumber: string;
  rarity: string;
  imageUrl: string | null;
  prices: Partial<Record<Currency, string | null>>;
  scryfallUri: string;
}

export interface PriceDisplay {
  text: string;
  currency: Currency;
}

interface ScryfallClientOptions {
  fetch?: typeof fetch;
  minIntervalMs?: number;
  baseUrl?: string;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const currencySet = new Set<string>(CURRENCIES);
const priceFallbacks: Record<Currency, readonly Currency[]> = {
  usd: ["usd", "usd_foil", "usd_etched"],
  usd_foil: ["usd_foil", "usd", "usd_etched"],
  usd_etched: ["usd_etched", "usd_foil", "usd"],
  eur: ["eur", "eur_foil"],
  eur_foil: ["eur_foil", "eur"],
  tix: ["tix"],
};

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function parseCard(json: unknown): CardInfo {
  const card = asObject(json);
  const id = card?.id;
  const name = card?.name;
  if (!card || typeof id !== "string" || id.length === 0 || typeof name !== "string" || name.length === 0) {
    throw new Error("Invalid Scryfall card: missing id or name");
  }

  const firstFace = Array.isArray(card.card_faces) ? asObject(card.card_faces[0]) : null;
  const imageUris = asObject(card.image_uris) ?? asObject(firstFace?.image_uris);
  const rawPrices = asObject(card.prices);
  const prices: Partial<Record<Currency, string | null>> = {};
  if (rawPrices) {
    for (const [key, value] of Object.entries(rawPrices)) {
      if (currencySet.has(key) && (typeof value === "string" || value === null)) {
        prices[key as Currency] = value;
      }
    }
  }

  return {
    id,
    name,
    setName: stringValue(card.set_name),
    setCode: stringValue(card.set).toUpperCase(),
    collectorNumber: stringValue(card.collector_number),
    rarity: stringValue(card.rarity),
    imageUrl: typeof imageUris?.normal === "string" ? imageUris.normal : null,
    prices,
    scryfallUri: stringValue(card.scryfall_uri),
  };
}

export function formatPrice(card: CardInfo, currency: Currency): PriceDisplay | null {
  for (const candidate of priceFallbacks[currency]) {
    const value = card.prices[candidate];
    if (typeof value !== "string" || value.trim() === "") continue;
    const amount = Number(value);
    if (!Number.isFinite(amount)) continue;

    const formatted = amount.toFixed(2);
    const text = candidate.startsWith("usd")
      ? `$${formatted}`
      : candidate.startsWith("eur")
        ? `€${formatted}`
        : `${formatted} TIX`;
    return { text, currency: candidate };
  }
  return null;
}

export class ScryfallClient {
  private readonly fetcher: typeof fetch;
  private readonly minIntervalMs: number;
  private readonly baseUrl: string;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly cache = new Map<string, CardInfo>();
  private readonly inFlight = new Map<string, Promise<CardInfo>>();
  private requestQueue: Promise<void> = Promise.resolve();
  private nextAllowedAt = 0;

  constructor(options: ScryfallClientOptions = {}) {
    this.fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.minIntervalMs = Math.max(0, options.minIntervalMs ?? 100);
    this.baseUrl = (options.baseUrl ?? "https://api.scryfall.com").replace(/\/+$/, "");
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  getCard(id: string, signal?: AbortSignal): Promise<CardInfo> {
    const cached = this.cache.get(id);
    if (cached) return Promise.resolve(cached);

    const pending = this.inFlight.get(id);
    if (pending) return pending;

    const request = this.fetchCard(id, signal)
      .then((card) => {
        this.cache.set(id, card);
        return card;
      })
      .finally(() => {
        this.inFlight.delete(id);
      });
    this.inFlight.set(id, request);
    return request;
  }

  private async fetchCard(id: string, signal?: AbortSignal): Promise<CardInfo> {
    await this.waitForRequestSlot();
    const response = await this.fetcher(`${this.baseUrl}/cards/${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json" },
      ...(signal ? { signal } : {}),
    });

    if (!response.ok) {
      let details = "";
      try {
        const body: unknown = await response.json();
        const detailValue = asObject(body)?.details;
        if (typeof detailValue === "string" && detailValue.length > 0) details = `: ${detailValue}`;
      } catch {
        // The status remains useful when the response body is not JSON.
      }
      throw new Error(`Scryfall request failed with status ${response.status}${details}`);
    }

    return parseCard(await response.json());
  }

  private waitForRequestSlot(): Promise<void> {
    const scheduled = this.requestQueue.then(async () => {
      const waitMs = Math.max(0, this.nextAllowedAt - this.now());
      if (waitMs > 0) await this.sleep(waitMs);
      this.nextAllowedAt = this.now() + this.minIntervalMs;
    });
    this.requestQueue = scheduled.then(
      () => undefined,
      () => undefined,
    );
    return scheduled;
  }
}

