import { createMemo, createSignal, onSettled, Show } from "solid-js";
import type { CardInfo } from "../scryfall";
import type { OverlaySettings } from "../settings";
import { placeFollowPanel, type FollowPlacement, type Size } from "./followPlacement";
import { CardDetails, CardImage, CardName } from "./Panel";

/** Compact panel placed beside the tracked card; it keeps its last placement and content while fading out. */
export function FollowPanel(props: {
  card: CardInfo | null;
  confidence: number | null;
  settings: OverlaySettings;
  corners: readonly (readonly [number, number])[] | null;
  canvas: Size;
  visible: boolean;
  placeholder: boolean;
}) {
  let element!: HTMLElement;
  const [size, setSize] = createSignal<Size | null>(null);

  onSettled(() => {
    const observer = new ResizeObserver(() => {
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      setSize((previous) => (previous?.width === width && previous.height === height ? previous : { width, height }));
    });
    observer.observe(element);
    return () => observer.disconnect();
  });

  const placement = createMemo<FollowPlacement | null>((previous) => {
    const measured = size();
    const corners = props.corners;
    if (!measured || measured.width === 0 || measured.height === 0 || !corners) return previous ?? null;
    return placeFollowPanel(corners, measured, props.canvas, props.settings.followSides) ?? previous ?? null;
  });

  return (
    <aside
      ref={element}
      class={[
        "follow",
        "surface",
        { "follow--visible": props.visible && placement() !== null, "follow--measuring": placement() === null },
      ]}
      data-side={placement()?.side}
      style={{
        left: `${placement()?.left ?? 0}px`,
        top: `${placement()?.top ?? 0}px`,
        "font-size": `${props.settings.followTextSize ?? props.settings.textSize}px`,
      }}
      aria-live="polite"
    >
      <Show when={props.card}>
        {(card) => (
          <>
            <Show when={props.settings.showImage && (card().imageUrl || props.placeholder)}>
              <div class="follow__image">
                <CardImage card={card()} placeholder={props.placeholder} />
              </div>
            </Show>
            <div class="follow__body">
              <CardName card={card()} />
              <Show when={props.settings.details.length > 0}>
                <CardDetails
                  card={card()}
                  fields={props.settings.details}
                  currency={props.settings.currency}
                  allFinishes={props.settings.allFinishes}
                  confidence={props.confidence}
                />
              </Show>
            </div>
          </>
        )}
      </Show>
    </aside>
  );
}
