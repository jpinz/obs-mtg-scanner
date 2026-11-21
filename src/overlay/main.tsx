import { render } from "@solidjs/web";
import "./overlay.css";
import { isSessionId, PREVIEW_PARAM, SESSION_PARAM } from "../overlayState";
import { parseSettings } from "../settings";
import { Overlay } from "./Overlay";

const settings = parseSettings("");
const query = new URLSearchParams(window.location.search);
const session = query.get(SESSION_PARAM);
const preview = query.get(PREVIEW_PARAM) === "1";
const root = document.documentElement;
root.dataset.theme = settings.theme;
root.style.setProperty("--accent", settings.accent);

render(
  () => <Overlay settings={settings} sessionId={isSessionId(session) ? session : null} preview={preview} />,
  document.getElementById("app")!,
);
