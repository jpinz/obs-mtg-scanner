import { render } from "@solidjs/web";
import "./app.css";
import { App } from "./App";
import { loadOverlaySession } from "./overlaySession";

const session = await loadOverlaySession(localStorage);
render(() => <App session={session} />, document.getElementById("app")!);
