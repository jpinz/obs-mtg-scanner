import { createSignal, For, onSettled } from "solid-js";
import { Portal } from "@solidjs/web";
import type { IgnoreZone } from "../settings";

type Point = readonly [number, number];

export function IgnoreZoneEditor(props: {
  frame: HTMLDivElement;
  mirror: boolean;
  zones: readonly IgnoreZone[];
  onChange(zones: readonly IgnoreZone[]): void;
  onDone(): void;
}) {
  const [draft, setDraft] = createSignal<readonly Point[]>([]);
  const [cursor, setCursor] = createSignal<Point>([0.5, 0.5]);
  const [error, setError] = createSignal("");
  const [bounds, setBounds] = createSignal({ left: 0, top: 0, width: 0, height: 0 });

  onSettled(() => {
    const update = () => {
      const video = props.frame.querySelector("video");
      const width = props.frame.clientWidth;
      const height = props.frame.clientHeight;
      if (!video?.videoWidth || !video.videoHeight || !width || !height) {
        setBounds({ left: 0, top: 0, width: 0, height: 0 });
        return;
      }
      const scale = Math.min(width / video.videoWidth, height / video.videoHeight);
      const w = video.videoWidth * scale;
      const h = video.videoHeight * scale;
      setBounds({ left: (width - w) / 2, top: (height - h) / 2, width: w, height: h });
    };
    const observer = new ResizeObserver(update);
    observer.observe(props.frame);
    props.frame.addEventListener("loadedmetadata", update, true);
    props.frame.addEventListener("resize", update, true);
    update();
    return () => {
      observer.disconnect();
      props.frame.removeEventListener("loadedmetadata", update, true);
      props.frame.removeEventListener("resize", update, true);
    };
  });

  const displayPoint = ([x, y]: Point): Point => [props.mirror ? 1 - x : x, y];
  const points = (zone: IgnoreZone) => zone.map((point) => displayPoint(point).map((n) => n * 1000).join(",")).join(" ");
  const addPoint = (point: Point) => {
    setDraft((current) => [...current, [props.mirror ? 1 - point[0] : point[0], point[1]]]);
    setError("");
  };
  const save = () => {
    const zone = draft();
    const area = zone.reduce((sum, point, i) => {
      const next = zone[(i + 1) % zone.length];
      return sum + point[0] * next[1] - next[0] * point[1];
    }, 0);
    if (zone.length < 3 || Math.abs(area) <= 0.000001) {
      setError("Add at least three points enclosing an area.");
      return;
    }
    props.onChange([...props.zones, zone]);
    setDraft([]);
    setError("");
  };

  return (
    <>
      <Portal mount={props.frame}><svg
        class="ignore-zones"
        style={{ left: `${bounds().left}px`, top: `${bounds().top}px`, width: `${bounds().width}px`, height: `${bounds().height}px` }}
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        tabindex="0"
        role="application"
        aria-label="Ignore zone editor. Click to add points, or use arrow keys to move the cursor and Enter to add a point."
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          addPoint([Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))]);
        }}
        onKeyDown={(event) => {
          const delta = event.shiftKey ? 0.1 : 0.01;
          const [x, y] = cursor();
          if (event.key === "Enter" || event.key === " ") addPoint(cursor());
          else if (event.key === "ArrowLeft") setCursor([Math.max(0, x - delta), y]);
          else if (event.key === "ArrowRight") setCursor([Math.min(1, x + delta), y]);
          else if (event.key === "ArrowUp") setCursor([x, Math.max(0, y - delta)]);
          else if (event.key === "ArrowDown") setCursor([x, Math.min(1, y + delta)]);
          else return;
          event.preventDefault();
        }}
      >
        <For each={props.zones}>{(zone) => <polygon class="ignore-zones__saved" points={points(zone)} />}</For>
        <polyline class="ignore-zones__draft" points={points(draft())} />
        <For each={draft()}>{(point) => {
          const p = () => displayPoint(point);
          return <circle class="ignore-zones__point" cx={p()[0] * 1000} cy={p()[1] * 1000} r="8" />;
        }}</For>
        <circle class="ignore-zones__cursor" cx={cursor()[0] * 1000} cy={cursor()[1] * 1000} r="12" />
      </svg></Portal>
      <div class="ignore-controls">
        <p>Click the video to add points. Use arrow keys and Enter to add points with a keyboard.</p>
        <div class="preview__actions">
          <button type="button" class="button button--secondary" disabled={!draft().length} onClick={() => setDraft((current) => current.slice(0, -1))}>Undo point</button>
          <button type="button" class="button button--secondary" onClick={save}>Save zone</button>
          <button type="button" class="button button--secondary" onClick={props.onDone}>Done</button>
        </div>
        {error() && <p role="alert">{error()}</p>}
        <For each={props.zones}>{(_zone, index) => (
          <button type="button" class="button button--secondary" onClick={() => props.onChange(props.zones.filter((_, i) => i !== index()))}>
            Remove zone {index() + 1}
          </button>
        )}</For>
      </div>
    </>
  );
}
