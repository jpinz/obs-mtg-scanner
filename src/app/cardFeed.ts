import type { CardInfo } from "../scryfall";
import { PresenceTracker } from "./presence";

export interface CardFeedDeps {
  lookup(cardId: string, signal: AbortSignal): Promise<CardInfo>;
  /** Publishes card state to the overlay; `null` hides the panel. */
  publish(card: CardInfo | null, confidence: number | null): void;
  onError(message: string): void;
}

/**
 * Turns scanner detections into what the overlay shows: looks each new card up
 * once, keeps it up while it stays in frame, and hides it `durationMs` after it leaves.
 */
export class CardFeed {
  private readonly presence: PresenceTracker;
  private lookup: AbortController | null = null;

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
    return this.presence.cardId;
  }

  observe(cardPresent: boolean, now: number): void {
    this.presence.observe(cardPresent, now);
  }

  async detected(cardId: string, now: number, confidence: number | null = null): Promise<void> {
    if (!this.presence.show(cardId, now)) return;
    this.lookup?.abort();
    const controller = new AbortController();
    this.lookup = controller;
    try {
      const card = await this.deps.lookup(cardId, controller.signal);
      if (controller.signal.aborted || this.presence.cardId !== cardId) return;
      this.deps.publish(card, confidence);
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error("Scryfall lookup failed", error);
      // Forget the card so the next detection of it retries the lookup.
      if (this.presence.cardId === cardId) {
        this.presence.clear();
        this.deps.publish(null, null);
      }
      this.deps.onError(`Card lookup failed for ${cardId}`);
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
    this.deps.publish(null, null);
  }
}
