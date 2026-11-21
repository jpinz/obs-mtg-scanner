import { createSignal, For, onSettled, Show } from "solid-js";
import { formatPrice, ScryfallClient, type CardInfo } from "../scryfall";
import { CURRENCY_LABELS, type Currency } from "../settings";
import { summarizeHistory, type HistoryEntry } from "./history";

export function HistoryPanel(props: {
  entries: readonly HistoryEntry[];
  currency: Currency;
  client: ScryfallClient;
  onAdd(card: CardInfo): void;
  onReplace(id: string, card: CardInfo): void;
  onRemove(id: string): void;
}) {
  const [query, setQuery] = createSignal("");
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [searchOpen, setSearchOpen] = createSignal(false);
  const [results, setResults] = createSignal<CardInfo[]>([]);
  const [page, setPage] = createSignal(0);
  const [hasMore, setHasMore] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  let request: AbortController | undefined;
  let searched = "";

  function openSearch(entry?: HistoryEntry) {
    request?.abort();
    setLoading(false);
    setEditingId(entry?.id ?? null);
    setQuery(entry?.card.name ?? "");
    setResults([]);
    setPage(0);
    setHasMore(false);
    setError(null);
    setSearchOpen(true);
  }

  function closeSearch() {
    request?.abort();
    setLoading(false);
    setSearchOpen(false);
  }

  async function search(nextPage = 1) {
    request?.abort();
    const controller = new AbortController();
    request = controller;
    if (nextPage === 1) {
      searched = query().trim();
      setResults([]);
      setPage(0);
      setHasMore(false);
    }
    setLoading(true);
    setError(null);
    try {
      const found = await props.client.searchPrintings(searched, nextPage, controller.signal);
      if (controller.signal.aborted) return;
      setResults((previous) => nextPage === 1 ? found.cards : [...previous, ...found.cards]);
      setPage(nextPage);
      setHasMore(found.hasMore);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  onSettled(() => () => request?.abort());
  const summary = () => summarizeHistory(props.entries, props.currency);

  return (
    <section class="history" aria-labelledby="history-heading">
      <div class="history__heading">
        <div>
          <h2 id="history-heading">Card history</h2>
          <p>{summary().count} {summary().count === 1 ? "card" : "cards"} · {summary().text}</p>
        </div>
        <button type="button" class="button button--primary" onClick={() => openSearch()}>Add card</button>
      </div>
      <p class="help">Prices use {CURRENCY_LABELS[props.currency]} with finish fallback.
        {summary().missing > 0 && ` ${summary().missing} without a price.`}
        {summary().fallback > 0 && ` ${summary().fallback} using another finish.`}
      </p>
      <Show when={searchOpen()}>
        <div class="history-search">
          <h3>{editingId() ? "Replace printing" : "Add a printing"}</h3>
          <form onSubmit={(event) => { event.preventDefault(); void search(); }}>
            <label for="history-query">Card name</label>
            <div class="history-search__row">
              <input id="history-query" type="text" value={query()} onInput={(event) => setQuery(event.currentTarget.value)} placeholder="e.g. Sol Ring" required />
              <button class="button button--secondary" type="submit" disabled={loading()}>Search</button>
            </div>
          </form>
          <p class="help">Search Scryfall and select the matching set and collector number.</p>
          <p class="history__error" role="alert" hidden={!error()}>{error()}</p>
          <p class="help" role="status" hidden={!loading()} >Searching printings…</p>
          <ul class="history-results">
            <For each={results()} keyed={(card) => card.id}>
              {(card) => (
                <li>
                  <button type="button" onClick={() => {
                    const id = editingId();
                    if (id) props.onReplace(id, card());
                    else props.onAdd(card());
                    closeSearch();
                  }}>
                    <strong>{card().name}</strong>
                    <span>{card().setName} · {card().setCode} #{card().collectorNumber} · {formatPrice(card(), props.currency)?.text ?? "No price"}</span>
                  </button>
                </li>
              )}
            </For>
          </ul>
          <Show when={hasMore()}>
            <button type="button" class="button button--secondary" disabled={loading()} onClick={() => void search(page() + 1)}>More printings</button>
          </Show>
          <button type="button" class="button button--secondary" onClick={closeSearch}>Cancel</button>
        </div>
      </Show>
      <Show when={props.entries.length > 0} fallback={<p class="history__empty">Scanned cards appear here. You can also add a printing manually.</p>}>
        <ul class="history-list">
          <For each={props.entries} keyed={(entry) => entry.id}>
            {(entry) => (
              <li>
                <div class="history-list__card">
                  <strong>{entry().card.name}</strong>
                  <span>{entry().card.setName} · {entry().card.setCode} #{entry().card.collectorNumber}</span>
                  <span>{formatPrice(entry().card, props.currency)?.text ?? "No price"}</span>
                </div>
                <div class="history-list__actions">
                  <button type="button" class="button button--secondary" aria-label={`Edit ${entry().card.name}`} onClick={() => openSearch(entry())}>Edit</button>
                  <button type="button" class="button button--secondary" aria-label={`Remove ${entry().card.name}`} onClick={() => {
                    if (editingId() === entry().id) closeSearch();
                    props.onRemove(entry().id);
                  }}>Remove</button>
                </div>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  );
}
