import type { CardInfo, ScannedCard } from "../scryfall";
import type { OverlaySettings } from "../settings";
import { PresenceTracker } from "./presence";

type CardIgnoreSettings = Pick<OverlaySettings, "ignoreArtCards" | "ignoreTokenCards" | "ignoreNonPlayableCards">;

export function isIgnoredCard(card: ScannedCard, settings: CardIgnoreSettings): boolean {
  return (settings.ignoreArtCards && card.isArtCard)
    || (settings.ignoreTokenCards && card.isTokenCard)
    || (settings.ignoreNonPlayableCards && card.isNonPlayable);
}

export interface CardFeedDeps {
  lookup(cardId: string, signal: AbortSignal): Promise<ScannedCard>;
  shouldIgnore(card: ScannedCard): boolean;
  /** Publishes card state to the overlay; `null` hides the panel. */
  publish(card: CardInfo | null, confidence: number | null): void;
  onNewCard(card: CardInfo, seenAt: string): void;
  onError(message: string | null): void;
}

interface ResolvedCard {
  result: ScannedCard;
  confidence: number | null;
  seenAt: string;
  recorded: boolean;
}

/**
 * Looks up detections, suppresses ignored cards, and hides the panel after the card leaves.
 */
export class CardFeed {
  private readonly presence: PresenceTracker;
  private lookup: AbortController | null = null;
  private current: ResolvedCard | null = null;
  private displayed: ResolvedCard | null = null;

  constructor(
    private readonly deps: CardFeedDeps,
    durationMs: number,
  ) {
    this.presence = new PresenceTracker(durationMs);
  }

  set durationMs(value: number) {
    this.presence.durationMs = value;
  }

  get cardId(): string | null {
    return this.displayed?.result.card.id === this.presence.cardId ? this.presence.cardId : null;
  }

  observe(cardPresent: boolean, now: number): void {
    this.presence.observe(cardPresent, now);
  }

  async detected(cardId: string, now: number, confidence: number | null = null): Promise<void> {
    if (!this.presence.show(cardId, now)) return;
    const seenAt = new Date().toISOString();
    this.lookup?.abort();
    this.current = null;
    const controller = new AbortController();
    this.lookup = controller;
    try {
      const result = await this.deps.lookup(cardId, controller.signal);
      if (controller.signal.aborted || this.presence.cardId !== cardId) return;
      this.deps.onError(null);
      this.current = { result, confidence, seenAt, recorded: false };
      this.refreshIgnoreRules();
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error("Scryfall lookup failed", error);
      // Forget the card so the next detection of it retries the lookup.
      if (this.presence.cardId === cardId) {
        this.presence.clear();
        this.hide();
      }
      this.deps.onError(`Card lookup failed for ${cardId}`);
    }
  }

  refreshIgnoreRules(): void {
    const current = this.current;
    if (current) {
      if (this.deps.shouldIgnore(current.result)) {
        if (this.displayed) {
          this.displayed = null;
          this.deps.publish(null, null);
        }
      } else if (this.displayed !== current) {
        const isNew = !current.recorded;
        current.recorded = true;
        this.displayed = current;
        this.deps.publish(current.result.card, current.confidence);
        if (isNew) this.deps.onNewCard(current.result.card, current.seenAt);
      }
    } else if (this.displayed && this.deps.shouldIgnore(this.displayed.result)) {
      this.displayed = null;
      this.deps.publish(null, null);
    }
  }

  /** Call periodically; hides the panel once the card has been gone long enough. */
  tick(now: number): void {
    if (this.presence.expire(now)) this.hide();
  }

  clear(): void {
    this.presence.clear();
    this.hide();
  }

  private hide(): void {
    this.lookup?.abort();
    this.lookup = null;
    this.current = null;
    this.displayed = null;
    this.deps.publish(null, null);
  }
}
