import type { CardInfo, PriceDisplay } from "../scryfall";
import type { Currency, OverlaySettings } from "../settings";

export const CURRENCY_LABELS: Record<Currency, string> = {
  usd: "USD",
  usd_foil: "USD foil",
  usd_etched: "USD etched",
  eur: "EUR",
  eur_foil: "EUR foil",
  tix: "MTGO",
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export class InfoPanel {
  readonly root: HTMLElement;

  private renderToken = 0;

  constructor(private settings: OverlaySettings) {
    this.root = el("aside", "panel");
    this.root.setAttribute("aria-live", "polite");
  }

  /** Renders the card and reveals the panel once its image has decoded, so it never pops in half-empty. */
  async render(card: CardInfo, price: PriceDisplay | null): Promise<void> {
    const token = ++this.renderToken;
    const content: HTMLElement[] = [];
    let image: HTMLImageElement | null = null;

    if (this.settings.showImage && card.imageUrl) {
      image = el("img", "panel__image");
      image.alt = card.name;
      image.src = card.imageUrl;
      image.referrerPolicy = "no-referrer";
      content.push(image);
    }

    const body = el("div", "panel__body");
    body.append(el("h1", "panel__name", card.name));

    if (this.settings.showSet) {
      const meta = el("p", "panel__meta");
      const rarity = el("span", `panel__rarity panel__rarity--${card.rarity}`, card.rarity);
      meta.append(`${card.setName} · ${card.setCode} #${card.collectorNumber} · `, rarity);
      body.append(meta);
    }

    const priceRow = el("p", "panel__price");
    if (price) {
      priceRow.append(
        el("span", "panel__price-value", price.text),
        el("span", "panel__price-label", CURRENCY_LABELS[price.currency]),
      );
    } else {
      priceRow.append(el("span", "panel__price-missing", "No price data"));
    }
    body.append(priceRow);
    content.push(body);

    // A broken image still shows the text; cap the wait so a slow CDN can't stall the panel.
    if (image) {
      await Promise.race([image.decode().catch(() => undefined), new Promise((r) => setTimeout(r, 3000))]);
    }
    if (token !== this.renderToken) return;

    this.root.replaceChildren(...content);
    this.root.classList.remove("panel--error");
    this.root.classList.add("panel--visible");
  }

  renderError(message: string): void {
    this.renderToken++;
    this.root.replaceChildren(el("p", "panel__error", message));
    this.root.classList.add("panel--visible", "panel--error");
  }

  hide(): void {
    this.renderToken++;
    this.root.classList.remove("panel--visible");
  }
}
