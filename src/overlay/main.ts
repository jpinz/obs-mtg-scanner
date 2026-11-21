import "./overlay.css";
import { formatPrice, ScryfallClient } from "../scryfall";
import { parseSettings } from "../settings";
import { InfoPanel } from "./panel";
import { PresenceTracker } from "./presence";
import { startScanner } from "./scanner";

const settings = parseSettings(window.location.search);
const app = document.querySelector<HTMLDivElement>("#app")!;
const root = document.documentElement;

root.dataset.theme = settings.theme;
root.dataset.position = settings.position;
root.classList.toggle("mirror", settings.mirror);
root.classList.toggle("debug", settings.debug);
root.style.setProperty("--accent", settings.accent);
root.style.setProperty("--scale", String(settings.scale));

const stage = document.createElement("div");
stage.className = "stage";
const notice = document.createElement("p");
notice.className = "notice";
const panel = new InfoPanel(settings);
app.append(stage, panel.root, notice);

const scryfall = new ScryfallClient();
const presence = new PresenceTracker(settings.duration * 1000);
let lookupController: AbortController | null = null;

function setNotice(message: string | null, isError = false) {
  notice.textContent = message ?? "";
  notice.hidden = message === null;
  notice.classList.toggle("notice--error", isError);
}

async function showCard(cardId: string) {
  if (!presence.show(cardId, performance.now())) return;
  lookupController?.abort();
  const controller = new AbortController();
  lookupController = controller;
  try {
    const card = await scryfall.getCard(cardId, controller.signal);
    if (controller.signal.aborted || presence.cardId !== cardId) return;
    await panel.render(card, formatPrice(card, settings.currency));
  } catch (error) {
    if (controller.signal.aborted) return;
    console.error("Scryfall lookup failed", error);
    if (settings.debug) panel.renderError(`Lookup failed for ${cardId}`);
  }
}

window.setInterval(() => {
  if (presence.expire(performance.now())) {
    lookupController?.abort();
    panel.hide();
  }
}, 250);

setNotice("Loading card scanner…");

startScanner(stage, settings, {
  onProgress(progress) {
    if (progress.ratio !== undefined && progress.stage !== "dewarp") {
      setNotice(`Loading ${progress.stage}… ${Math.round(progress.ratio * 100)}%`);
    }
  },
  onReady(info) {
    setNotice(settings.debug ? `Scanning (${info.inferenceMode ?? "WASM"}, ${info.numThreads ?? 1} threads)` : null);
  },
  onResult(result) {
    presence.observe(result.cardPresent && result.cornersValid, performance.now());
  },
  onCardDetected(card) {
    void showCard(card.cardId);
  },
  onError(message) {
    console.error("CollectorVision error:", message);
    setNotice(message, true);
  },
}).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const hint = error instanceof DOMException && ["NotAllowedError", "NotFoundError"].includes(error.name)
    ? " – camera unavailable. In OBS, launch with --enable-media-stream and make sure no other source is using this camera."
    : "";
  setNotice(`${message}${hint}`, true);
});
