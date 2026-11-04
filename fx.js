import { animate, stagger } from "motion";
import { formatValue } from "./game.js";

// render() replaces the whole dashboard, so CSS transitions never see a change. Instead, read the screen
// just before a render and animate the difference just after it. Elements are matched by position,
// which holds because every render draws the same layout.
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const spring = { type: "spring", bounce: 0.25, duration: 0.7 };
const all = (selector) => [...document.querySelectorAll(selector)];
const number = (el) => Number(el.textContent.replace(/[^\d.]/g, "")) || 0;

export function snapshot() {
  return {
    view: document.querySelector(".page-view.is-active")?.id,
    bars: all(".progress-track span").map((el) => parseFloat(el.style.width) || 0),
    finished: all(".quest-card").map((el) => el.classList.contains("is-finished")),
    level: number(document.querySelector(".level-orb") ?? { textContent: "" }),
    counts: all(".hero-stats strong").map(number),
    notice: document.querySelector(".notice")?.textContent,
  };
}

export function play(before) {
  if (!before.view || reduce.matches) return; // first paint after login, or motion is off

  const view = document.querySelector(".page-view.is-active");
  if (view && view.id !== before.view) {
    animate([...view.querySelectorAll(":scope > *, :scope > * > *")].slice(0, 10), { opacity: [0, 1], y: [12, 0] }, { delay: stagger(0.04), duration: 0.35, ease: [0.23, 1, 0.32, 1] });
  }

  // Bars grow from where they were; shrinking (a new day) just snaps.
  all(".progress-track span").forEach((el, i) => {
    const from = before.bars[i], to = parseFloat(el.style.width) || 0;
    if (from !== undefined && to > from) animate(el, { scaleX: [from / to, 1] }, spring);
  });

  all(".quest-card").forEach((el, i) => {
    if (el.classList.contains("is-finished") && before.finished[i] === false) {
      animate(el, { scale: [0.96, 1.03, 1] }, { duration: 0.5, ease: "easeOut" });
      const result = el.querySelector(".quest-result");
      if (result) animate(result, { opacity: [0, 1], y: [6, 0] }, { delay: 0.15, duration: 0.3 });
    }
  });

  const orbs = all(".level-orb");
  if (orbs.length && number(orbs[0]) > before.level) animate(orbs, { scale: [1.5, 1] }, { type: "spring", bounce: 0.5, duration: 0.8 });

  all(".hero-stats strong").forEach((el, i) => {
    const from = before.counts[i], to = number(el);
    if (from !== undefined && to > from) animate(from, to, { duration: 0.8, ease: "easeOut", onUpdate: (v) => (el.textContent = formatValue(Math.round(v))) });
  });

  const notice = document.querySelector(".notice");
  if (notice && notice.textContent !== before.notice) animate(notice, { opacity: [0, 1], y: [-6, 0] }, { duration: 0.3, ease: "easeOut" });
}
