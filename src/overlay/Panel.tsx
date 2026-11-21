import { createEffect, createSignal, For, Show, type Accessor } from "solid-js";
import { formatFinishPrices, formatPrice, type CardInfo } from "../scryfall";
import { CURRENCY_LABELS, type Currency, type DetailField } from "../settings";

/** Resolves once the image is decoded (or failed, or 3s passed) so components never pop in half-empty. */
function preload(url: string | null): Promise<void> {
  if (!url) return Promise.resolve();
  const image = new Image();
  image.referrerPolicy = "no-referrer";
  image.src = url;
  return Promise.race([
    image.decode().catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, 3000)),
  ]).then(() => undefined);
}

/**
 * The card to render and whether it should be visible. A new card is shown once its image is preloaded;
 * when the card goes away the old content is kept so it can fade out.
 */
export function useShownCard(card: Accessor<CardInfo | null>, withImage: Accessor<boolean>) {
  const [shown, setShown] = createSignal<CardInfo | null>(null);
  const [visible, setVisible] = createSignal(false);

  createEffect(
    () => ({ card: card(), url: withImage() ? card()?.imageUrl ?? null : null }),
    ({ card, url }) => {
      if (!card) {
        setVisible(false);
        return;
      }
      let cancelled = false;
      void preload(url).then(() => {
        if (cancelled) return;
        setShown(card);
        setVisible(true);
      });
      return () => {
        cancelled = true;
      };
    },
  );

  return { shown, visible };
}

export function CardImage(props: { card: CardInfo; placeholder?: boolean }) {
  return (
    <Show
      when={props.card.imageUrl}
      fallback={
        <Show when={props.placeholder}>
          <div class="card-image card-image--placeholder">Card image</div>
        </Show>
      }
    >
      {(url) => (
        <img class="card-image" src={url()} alt={props.card.name} referrerpolicy="no-referrer" draggable="false" />
      )}
    </Show>
  );
}

function textSize(size: number | null | undefined) {
  return size === null || size === undefined ? undefined : { "font-size": `${size}px` };
}

/** `size` (px) overrides the name's default size relative to its container. */
export function CardName(props: { card: CardInfo; size?: number | null }) {
  return <h1 class="card-name" style={textSize(props.size)}>{props.card.name}</h1>;
}

export function CardDetails(props: {
  card: CardInfo;
  fields: readonly DetailField[];
  currency: Currency;
  allFinishes: boolean;
  confidence: number | null;
  /** Per line sizes in px, overriding the line's default size relative to its container. */
  sizes?: Readonly<Partial<Record<DetailField, number>>>;
}) {
  const style = (field: DetailField) => textSize(props.sizes?.[field]);
  return (
    <div class="card-details">
      <For each={props.fields}>
        {(field) => (
          field === "set" ? <p class="card-detail" style={style(field)}>{props.card.setName}</p>
          : field === "number" ? <p class="card-detail" style={style(field)}>{props.card.setCode} #{props.card.collectorNumber}</p>
          : field === "rarity" ? (
            <p class="card-detail" style={style(field)}>
              <span class={["card-rarity", `card-rarity--${props.card.rarity}`]}>{props.card.rarity}</span>
            </p>
          )
          : field === "confidence" ? (
            <p class="card-detail" style={style(field)}>
              Confidence: {props.confidence === null ? "Unavailable" : `${(props.confidence * 100).toFixed(1)}%`}
            </p>
          )
          : <CardPrice card={props.card} currency={props.currency} allFinishes={props.allFinishes} size={props.sizes?.price} />
        )}
      </For>
    </div>
  );
}

function CardPrice(props: { card: CardInfo; currency: Currency; allFinishes: boolean; size?: number }) {
  const prices = () => props.allFinishes
    ? formatFinishPrices(props.card, props.currency)
    : [formatPrice(props.card, props.currency)].filter((price) => price !== null);
  const label = (currency: Currency) => {
    if (currency === "usd") return props.allFinishes ? "nonfoil" : "";
    if (currency === "usd_foil") return "foil";
    if (currency === "usd_etched") return "etched";
    return `${CURRENCY_LABELS[currency]}${props.allFinishes && currency === "eur" ? " nonfoil" : ""}`;
  };
  return (
    <div class="card-prices" style={textSize(props.size)}>
      <Show when={prices().length > 0} fallback={<span class="card-price__missing">No price data</span>}>
        <For each={prices()}>
          {(price) => (
            <p class="card-price">
              <span class="card-price__value">{price.text}</span>
              <Show when={label(price.currency)}>
                {(text) => <span class="card-price__label">{text()}</span>}
              </Show>
            </p>
          )}
        </For>
      </Show>
    </div>
  );
}
