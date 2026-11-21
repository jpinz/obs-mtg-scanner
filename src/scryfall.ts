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
    const price = formatExactPrice(card, candidate);
    if (price) return price;
  }
  return null;
}

function formatExactPrice(card: CardInfo, currency: Currency): PriceDisplay | null {
  const value = card.prices[currency];
  if (typeof value !== "string" || value.trim() === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;

  const formatted = amount.toFixed(2);
  const text = currency.startsWith("usd")
    ? `$${formatted}`
    : currency.startsWith("eur")
      ? `€${formatted}`
      : `${formatted} TIX`;
  return { text, currency };
}

/** Available prices for this printing in the selected currency, without finish fallbacks. */
export function formatFinishPrices(card: CardInfo, currency: Currency): PriceDisplay[] {
  const candidates: readonly Currency[] = currency.startsWith("usd")
    ? ["usd", "usd_foil", "usd_etched"]
    : currency.startsWith("eur")
      ? ["eur", "eur_foil"]
      : ["tix"];
  return candidates.flatMap((candidate) => {
    const price = formatExactPrice(card, candidate);
    return price ? [price] : [];
  });
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

  /** Search individual printings for the history editor. */
  async searchPrintings(name: string, pageNumber = 1, signal?: AbortSignal): Promise<{ cards: CardInfo[]; hasMore: boolean }> {
    const term = name.trim();
    if (!term) throw new Error("Enter a card name");
    const params = new URLSearchParams({
      q: `name:"${term.replace(/["\\]/g, "\\$&")}"`,
      unique: "prints",
      include_extras: "true",
      include_variations: "true",
      page: String(pageNumber),
    });
    const page = asObject(await this.fetchJson(`${this.baseUrl}/cards/search?${params}`, signal, 500));
    if (!page || !Array.isArray(page.data) || typeof page.has_more !== "boolean") {
      throw new Error("Invalid Scryfall card search response");
    }
    return { cards: page.data.map(parseCard), hasMore: page.has_more };
  }

  async searchCardIds(query: string, setCodes: readonly string[] = [], signal?: AbortSignal): Promise<string[]> {
    if (setCodes.some((code) => !/^[a-z0-9]+$/i.test(code))) {
      throw new Error("Set codes must contain only letters and numbers");
    }
    const filters: string[] = [];
    if (setCodes.length > 0) {
      filters.push(`(${setCodes.map((code) => `set:${code}`).join(" OR ")})`);
    }
    if (query.trim()) filters.push(`(${query.trim()})`);
    if (filters.length === 0) {
      throw new Error("Provide a set code or Scryfall query");
    }

    const params = new URLSearchParams({
      q: filters.join(" AND "),
      unique: "prints",
      include_extras: "true",
      include_variations: "true",
    });
    const ids = new Set<string>();
    for (let pageNumber = 1; ; pageNumber += 1) {
      params.set("page", String(pageNumber));
      const page = asObject(await this.fetchJson(`${this.baseUrl}/cards/search?${params}`, signal, 500));
      if (!page || !Array.isArray(page.data) || page.data.length === 0 || typeof page.has_more !== "boolean") {
        throw new Error("Invalid Scryfall card search: missing cards or pagination");
      }
      for (const json of page.data) {
        const id = asObject(json)?.id;
        if (typeof id !== "string" || id.length === 0) {
          throw new Error("Invalid Scryfall card search: missing card id");
        }
        ids.add(id);
      }
      if (!page.has_more) return [...ids];
    }
  }

  private async fetchCard(id: string, signal?: AbortSignal): Promise<CardInfo> {
    return parseCard(await this.fetchJson(`${this.baseUrl}/cards/${encodeURIComponent(id)}`, signal));
  }

  private async fetchJson(url: string, signal?: AbortSignal, intervalMs = this.minIntervalMs): Promise<unknown> {
    await this.waitForRequestSlot(intervalMs);
    const response = await this.fetcher(url, {
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

    return response.json();
  }

  private waitForRequestSlot(intervalMs: number): Promise<void> {
    const scheduled = this.requestQueue.then(async () => {
      const waitMs = Math.max(0, this.nextAllowedAt - this.now());
      if (waitMs > 0) await this.sleep(waitMs);
      this.nextAllowedAt = this.now() + Math.max(this.minIntervalMs, intervalMs);
    });
    this.requestQueue = scheduled.then(
      () => undefined,
      () => undefined,
    );
    return scheduled;
  }
}

