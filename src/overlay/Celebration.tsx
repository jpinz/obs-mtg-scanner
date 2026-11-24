import { createEffect, createSignal, onSettled, Show } from "solid-js";
import type { CelebrationEvent } from "../obsWebSocket";
import { soundSource } from "../celebration";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  spin: number;
  color: string;
}

export function Celebration(props: { event: CelebrationEvent | null; sound: boolean; preview?: boolean }) {
  let canvas!: HTMLCanvasElement;
  let frame = 0;
  let audio: HTMLAudioElement | undefined;
  let lastId: string | undefined;
  const [soundBlocked, setSoundBlocked] = createSignal(false);

  function playSound(sound: string | null) {
    audio?.pause();
    audio = new Audio(soundSource(sound));
    audio.volume = 0.65;
    void audio.play().then(() => setSoundBlocked(false)).catch(() => setSoundBlocked(true));
  }

  function burst() {
    cancelAnimationFrame(frame);
    const context = canvas.getContext("2d");
    if (!context) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    context.scale(ratio, ratio);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const colors = ["#f59e0b", "#fef3c7", "#38bdf8", "#c084fc", "#34d399"];
    const particles: Particle[] = Array.from({ length: reduced ? 16 : 90 }, (_, i) => {
      const side = i % 2 === 0 ? 1 : -1;
      return {
        x: side === 1 ? 0 : width,
        y: reduced ? height * (0.25 + Math.random() * 0.5) : height * 0.65,
        vx: side * width * (0.18 + Math.random() * 0.35),
        vy: -height * (0.4 + Math.random() * 0.6),
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 12,
        color: colors[i % colors.length],
      };
    });
    const start = performance.now();
    let previous = start;
    const duration = reduced ? 700 : 2200;
    function draw(now: number) {
      const elapsed = now - start;
      context!.clearRect(0, 0, width, height);
      if (elapsed >= duration || document.hidden) {
        frame = 0;
        return;
      }
      const dt = Math.min((now - previous) / 1000, 0.04);
      previous = now;
      context!.globalAlpha = Math.min(1, (duration - elapsed) / (reduced ? duration : 650));
      for (const particle of particles) {
        if (!reduced) {
          particle.x += particle.vx * dt;
          particle.y += particle.vy * dt;
          particle.vy += height * 0.95 * dt;
          particle.rotation += particle.spin * dt;
        }
        context!.save();
        context!.translate(reduced ? (particle.x === 0 ? 16 : width - 16) : particle.x, particle.y);
        context!.rotate(particle.rotation);
        context!.fillStyle = particle.color;
        context!.fillRect(-5, -3, 10, 6);
        context!.restore();
      }
      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
  }

  createEffect(() => props.event, (event) => {
    if (!event || event.id === lastId) return;
    lastId = event.id;
    if (document.hidden) return;
    burst();
    if (props.sound && !props.preview) playSound(event.sound);
  });
  createEffect(() => props.sound, (enabled) => {
    if (!enabled) {
      audio?.pause();
      setSoundBlocked(false);
    }
  });
  onSettled(() => () => {
    cancelAnimationFrame(frame);
    audio?.pause();
  });

  return (
    <>
      <canvas ref={canvas} aria-hidden="true" style={{ position: "fixed", inset: "0", width: "100%", height: "100%", "pointer-events": "none", "z-index": "20" }} />
      <Show when={soundBlocked()}>
        <button type="button" class="notice" onClick={() => playSound(props.event?.sound ?? null)}>
          Enable celebration sound
        </button>
      </Show>
    </>
  );
}
