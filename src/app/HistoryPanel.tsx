import { createEffect, createMemo, createSignal, For, onSettled, Show } from "solid-js";
import { formatPrice, ScryfallClient, type CardInfo } from "../scryfall";
import { CURRENCY_LABELS, type Currency } from "../settings";
import { summarizeHistory, type HistoryEntry } from "./history";

const timestampFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" });

export function HistoryPanel(props: {
  entries: readonly HistoryEntry[];
  currency: Currency;
  client: ScryfallClient;
  onAdd(card: CardInfo): void;
  onReplace(id: string, card: CardInfo): void;
  onRemove(ids: readonly string[]): void;
}) {
  const [query, setQuery] = createSignal("");
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [searchOpen, setSearchOpen] = createSignal(false);
  const [results, setResults] = createSignal<CardInfo[]>([]);
  const [page, setPage] = createSignal(0);
  const [hasMore, setHasMore] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [selectedIds, setSelectedIds] = createSignal<ReadonlySet<string>>(new Set());
  const selectedEntries = createMemo(() => {
    const selected = selectedIds();
    return props.entries.filter((entry) => selected.has(entry.id));
  });
  let selectAll: HTMLInputElement | undefined;
  let request: AbortController | undefined;
  let searched = "";

  createEffect(
    () => ({ selected: selectedEntries().length, total: props.entries.length }),
    ({ selected, total }) => {
      if (selectAll) selectAll.indeterminate = selected > 0 && selected < total;
    },
  );

  function selectEntry(id: string, checked: boolean) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function removeEntries(ids: readonly string[]) {
    const removed = new Set(ids);
    const edited = editingId();
    if (edited !== null && removed.has(edited)) closeSearch();
    setSelectedIds((previous) => new Set([...previous].filter((id) => !removed.has(id))));
    props.onRemove(ids);
  }

  function deleteSelected() {
    const selected = selectedEntries();
    if (!selected.length || !window.confirm(`Delete ${selected.length} selected ${selected.length === 1 ? "card" : "cards"} from history?`)) return;
    removeEntries(selected.map((entry) => entry.id));
  }

  function clearHistory() {
    const entries = props.entries;
    if (!entries.length || !window.confirm(`Clear all ${entries.length} ${entries.length === 1 ? "card" : "cards"} from history?`)) return;
    removeEntries(entries.map((entry) => entry.id));
  }

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
        <div class="history__bulk">
          <label class="history__select-all">
            <input type="checkbox"
              ref={selectAll}
              checked={selectedEntries().length === props.entries.length}
              onChange={(event) => setSelectedIds(event.currentTarget.checked ? new Set(props.entries.map((entry) => entry.id)) : new Set())} />
            <span>Select all</span>
          </label>
          <div class="history__bulk-buttons">
            <button type="button" class="button button--secondary" disabled={selectedEntries().length === 0} onClick={deleteSelected}>
              Delete selected{selectedEntries().length > 0 && ` (${selectedEntries().length})`}
            </button>
            <button type="button" class="button button--secondary" onClick={clearHistory}>Clear all</button>
          </div>
        </div>
        <ul class="history-list">
          <For each={props.entries} keyed={(entry) => entry.id}>
            {(entry) => (
              <li>
                <label class="history-list__select">
                  <input type="checkbox"
                    aria-label={`Select ${entry().card.name}, ${entry().card.setName} #${entry().card.collectorNumber}, recorded ${timestampFormat.format(new Date(entry().addedAt))}`}
                    checked={selectedIds().has(entry().id)}
                    onChange={(event) => selectEntry(entry().id, event.currentTarget.checked)} />
                  <span class="history-list__card">
                    <strong>{entry().card.name}</strong>
                    <span>{entry().card.setName} · {entry().card.setCode} #{entry().card.collectorNumber}</span>
                    <span>{formatPrice(entry().card, props.currency)?.text ?? "No price"}</span>
                    <time datetime={entry().addedAt}>Recorded {timestampFormat.format(new Date(entry().addedAt))}</time>
                  </span>
                </label>
                <div class="history-list__actions">
                  <button type="button" class="button button--secondary" aria-label={`Edit ${entry().card.name}`} onClick={() => openSearch(entry())}>Edit</button>
                  <button type="button" class="button button--secondary" aria-label={`Remove ${entry().card.name}`} onClick={() => removeEntries([entry().id])}>Remove</button>
                </div>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  );
}
