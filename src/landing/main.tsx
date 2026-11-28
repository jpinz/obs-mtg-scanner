import { render } from "@solidjs/web";
import "../app/app.css";
import "./landing.css";
import { Landing } from "./Landing";

// Preserve existing scanner links that configure the app through query parameters.
if (window.location.search) {
  window.location.replace(`./app.html${window.location.search}${window.location.hash}`);
} else {
  render(() => <Landing />, document.getElementById("app")!);
}
