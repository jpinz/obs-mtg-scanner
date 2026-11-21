/**
 * Tracks whether the info panel should remain visible: it stays up while any
 * card is in frame and hides `durationMs` after the last frame with a card.
 * A duration of 0 keeps the panel until another card replaces it.
 */
export class PresenceTracker {
  private current: string | null = null;
  private lastSeen = 0;

  constructor(public durationMs: number) {}

  get cardId(): string | null {
    return this.current;
  }

  show(cardId: string, now: number): boolean {
    const changed = cardId !== this.current;
    this.current = cardId;
    this.lastSeen = now;
    return changed;
  }

  observe(cardPresent: boolean, now: number): void {
    if (cardPresent && this.current) {
      this.lastSeen = now;
    }
  }

  clear(): void {
    this.current = null;
  }

  /** Returns true exactly once when the panel should be hidden. */
  expire(now: number): boolean {
    if (!this.current || this.durationMs <= 0 || now - this.lastSeen < this.durationMs) {
      return false;
    }
    this.current = null;
    return true;
  }
}
