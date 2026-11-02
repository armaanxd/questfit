import {
  createState,
  fitnessLevelInfo,
  formatValue,
  levelProgress,
  rankProgress,
  finishSession,
  sessionEnd,
  logProgress,
  logSet,
  missQuest,
  modeDetails,
  pauseSession,
  resetForNewDay,
  resumeSession,
  startSession,
  STAT_KEYS,
  useDayPass,
  workoutRotationDay,
  applyHealthReading,
} from "./game.js?v=8";
import * as health from "./health.js";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Preferences } from "@capacitor/preferences";

const STORAGE_KEY = "questfit-local-v1";
const SESSION_KEY = "questfit-session-v1";
const app = document.querySelector("#app");
const isNative = Capacitor.isNativePlatform();
const REMINDER_ID = 1;

// localStorage stays the sync cache; Preferences is the durable copy that iOS will not purge.
function persist(key, value) {
  if (value === null) {
    localStorage.removeItem(key);
    Preferences.remove({ key });
  } else {
    localStorage.setItem(key, value);
    Preferences.set({ key, value });
  }
}

for (const key of [STORAGE_KEY, SESSION_KEY]) {
  if (localStorage.getItem(key) !== null) continue;
  const { value } = await Preferences.get({ key });
  if (value !== null) localStorage.setItem(key, value);
}

let state = loadState();
let sessionActive = Boolean(state) || localStorage.getItem(SESSION_KEY) === "active";
let activeView = "dashboard";
let rolloverTimer = null;
let tickTimer = null;
let healthAvailable = null; // null until health.isAvailable() resolves
let companionReaction = null; // played once by the assistant on the next dashboard render

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return null;
    const next = resetForNewDay(saved);
    persist(STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

function saveState() {
  persist(STORAGE_KEY, JSON.stringify(state));
}

function renderLogin() {
  app.innerHTML = `
    <section class="login-shell">
      <div class="login-art">
        <div class="brand-mark">Q<span>/</span>F</div>
        <p class="eyebrow">THE EMBER VALLEY · LOCAL GATE</p>
        <h1>Return to your <em>main quest.</em></h1>
        <p class="muted large-copy">Your campaign, daily board, workouts, and stat sheet are waiting on this device.</p>
        <div class="login-sigil">✦</div>
      </div>
      <form class="panel login-card" id="login-form">
        <p class="eyebrow">Enter the world</p>
        <h2>Log in to QuestFit</h2>
        <label>Adventurer email<input name="email" type="email" required placeholder="you@example.com" autocomplete="email" /></label>
        <label>Passphrase<input name="password" type="password" required minlength="4" placeholder="Your local passphrase" autocomplete="current-password" /></label>
        <button class="primary-button wide" type="submit">Continue campaign <span>→</span></button>
        <p class="fine-print">Local prototype: this gate keeps your campaign on this browser. No account is sent to a server.</p>
        <button class="text-button login-create" type="button" data-action="create-account">New here? Create a campaign</button>
      </form>
    </section>
  `;
  document.querySelector("#login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!state) {
      renderOnboarding();
      return;
    }
    sessionActive = true;
    persist(SESSION_KEY, "active");
    render();
  });
  document.querySelector("[data-action=create-account]").addEventListener("click", () => renderOnboarding());
}

function scheduleReminder() {
  state.reminderUntil = Date.now() + 30 * 60 * 1000;
  state.reminderNotified = false;
  if (isNative) {
    LocalNotifications.schedule({ notifications: [{
      id: REMINDER_ID,
      title: "QuestFit reminder",
      body: "Your daily quest is waiting for you.",
      schedule: { at: new Date(state.reminderUntil), allowWhileIdle: true },
    }] }).catch(() => {});
  } else if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready.then((registration) => registration.active?.postMessage({
      type: "schedule-reminder",
      at: state.reminderUntil,
      title: "QuestFit reminder",
      body: "Your daily quest is waiting for you.",
    })).catch(() => {});
  }
}

async function requestReminder() {
  if (isNative) {
    const { display } = await LocalNotifications.requestPermissions().catch(() => ({ display: "denied" }));
    if (display !== "granted") {
      state.notice = "Notifications are off for QuestFit. Your companion will still remind you in-app.";
      return;
    }
    scheduleReminder();
    state.notice = "Your companion will remind you to return in 30 minutes.";
    return;
  }
  if (!("Notification" in window)) {
    state.notice = "Browser notifications are unavailable, so your companion will keep the reminder in-app.";
    return;
  }
  if (Notification.permission === "denied") {
    state.notice = "Notifications are blocked in this browser. Your companion will still remind you in-app.";
    return;
  }
  if (Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      state.notice = "Notifications were not enabled. Your companion will still remind you in-app.";
      return;
    }
  }
  scheduleReminder();
  state.notice = "Your companion will remind you to return in 30 minutes.";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#039;",
    '"': "&quot;",
  }[character]));
}

function iconForClass(className) {
  return { warrior: "⚔", ranger: "➶", mage: "✦", allrounder: "✹" }[className] || "✦";
}

function prettyClass(className) {
  if (className === "allrounder") return "All-Rounder";
  return className.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

const STAT_LABELS = {
  strength: "Strength",
  cardio: "Cardio",
  mobility: "Mobility",
  endurance: "Endurance",
  discipline: "Discipline",
  recovery: "Recovery",
  agility: "Agility",
  versatility: "Versatility",
};

const WORKOUT_LIBRARY = [
  { id: "shadow-strength", title: "Shadow Strength", category: "Strength", duration: "35 min", level: "Steady", description: "A focused full-body strength session for building force without rushing the form.", exercises: "Squats · Push-ups · Rows · Plank", image: "./workouts/shadow-strength.jpg", videoQuery: "full body strength workout form" },
  { id: "rift-intervals", title: "Rift Intervals", category: "Cardio", duration: "25 min", level: "Challenging", description: "Short bursts of effort with recovery windows to build speed and conditioning.", exercises: "Warm-up · 6 intervals · Cool-down", image: "./workouts/rift-intervals.jpg", videoQuery: "interval cardio workout beginner" },
  { id: "moonlit-mobility", title: "Moonlit Mobility", category: "Mobility", duration: "15 min", level: "Easy", description: "A calm mobility flow for hips, shoulders, and spine when recovery matters.", exercises: "Hips · Shoulders · Spine · Breathing", image: "./workouts/moonlit-mobility.jpg", videoQuery: "full body mobility routine" },
  { id: "hunter-full-body", title: "Hunter Full Body", category: "Full body", duration: "45 min", level: "Challenging", description: "A balanced session that touches strength, cardio, mobility, and core control.", exercises: "Lunges · Press · Cardio block · Core", image: "./workouts/shadow-strength.jpg", videoQuery: "full body gym workout" },
  { id: "ember-core", title: "Ember Core", category: "Core", duration: "20 min", level: "Steady", description: "Build trunk stability and control with a compact session for any equipment level.", exercises: "Dead bug · Side plank · Bird dog · Hollow hold", image: "./workouts/quick-core.jpg", videoQuery: "core workout no equipment" },
  { id: "recovery-walk", title: "Recovery Walk", category: "Recovery", duration: "30 min", level: "Easy", description: "A low-pressure walk to keep momentum while giving tired muscles room to recover.", exercises: "Easy pace · Nasal breathing · Light stretch", image: "./workouts/recovery-walk.jpg", videoQuery: "active recovery walking workout" },
  { id: "power-ladder", title: "Power Ladder", category: "Strength", duration: "30 min", level: "Challenging", description: "Build controlled power with ascending sets that leave room for clean technique.", exercises: "Split squat · Press · Hinge · Carry", image: "./workouts/power-ladder.jpg", videoQuery: "power strength workout technique" },
  { id: "upper-body-forge", title: "Upper Body Forge", category: "Strength", duration: "28 min", level: "Steady", description: "A compact upper-body session for shoulders, back, chest, and arms.", exercises: "Press · Row · Raise · Curl", image: "./workouts/upper-body-forge.jpg", videoQuery: "upper body strength workout" },
  { id: "trail-tempo", title: "Trail Tempo", category: "Cardio", duration: "30 min", level: "Steady", description: "Find a sustainable pace and hold it long enough to build an endurance base.", exercises: "Warm-up · Tempo block · Easy finish", image: "./workouts/trail-tempo.jpg", videoQuery: "tempo run workout" },
  { id: "low-impact-engine", title: "Low-Impact Engine", category: "Cardio", duration: "24 min", level: "Easy", description: "A joint-friendly conditioning session for days that need movement without pounding.", exercises: "March · Step touch · Reach · Cool-down", image: "./workouts/low-impact-engine.jpg", videoQuery: "low impact cardio workout" },
  { id: "deep-stretch", title: "Deep Stretch", category: "Mobility", duration: "20 min", level: "Easy", description: "Slow down and restore range of motion across the lower body and spine.", exercises: "Hamstrings · Hips · Calves · Spine", image: "./workouts/deep-stretch.jpg", videoQuery: "deep stretch flexibility routine" },
  { id: "balance-flow", title: "Balance Flow", category: "Mobility", duration: "18 min", level: "Steady", description: "Train balance, coordination, and control through deliberate single-leg work.", exercises: "Balance · Reach · Rotate · Breathe", image: "./workouts/balance-flow.jpg", videoQuery: "balance mobility workout" },
  { id: "quick-core", title: "Quick Core", category: "Core", duration: "12 min", level: "Steady", description: "A short core finisher for busy days when consistency matters more than volume.", exercises: "Plank · Crunch · Side plank · Hollow hold", image: "./workouts/quick-core.jpg", videoQuery: "12 minute core workout" },
  { id: "walk-run-awakening", title: "Walk-Run Awakening", category: "Cardio", duration: "35 min", level: "Easy", description: "Alternate walking and jogging to build confidence and an aerobic foundation.", exercises: "Walk · Jog · Walk · Stretch", image: "./workouts/walk-run-awakening.jpg", videoQuery: "walk run beginner workout" },
];

const CLASS_WORKOUT_PRIORITIES = {
  warrior: ["shadow-strength", "power-ladder", "upper-body-forge"],
  ranger: ["rift-intervals", "trail-tempo", "walk-run-awakening"],
  mage: ["moonlit-mobility", "deep-stretch", "balance-flow"],
  allrounder: ["hunter-full-body", "shadow-strength", "rift-intervals"],
};
const WORKOUT_DIFFICULTY = {
  "shadow-strength": 1,
  "rift-intervals": 3,
  "moonlit-mobility": 1,
  "hunter-full-body": 5,
  "ember-core": 1,
  "recovery-walk": 1,
  "power-ladder": 4,
  "upper-body-forge": 2,
  "trail-tempo": 2,
  "low-impact-engine": 1,
  "deep-stretch": 1,
  "balance-flow": 1,
  "quick-core": 1,
  "walk-run-awakening": 1,
};
const WORKOUT_RANKS = ["E", "D", "C", "B", "A", "S"];

function workoutRank(workout) {
  return WORKOUT_RANKS[(WORKOUT_DIFFICULTY[workout.id] || 1) - 1];
}

function dailyWorkoutRecommendations(className, day, fitnessLevel) {
  const priority = CLASS_WORKOUT_PRIORITIES[className] || CLASS_WORKOUT_PRIORITIES.warrior;
  const rotation = [...priority, ...WORKOUT_LIBRARY.map((workout) => workout.id).filter((id) => !priority.includes(id))];
  const rotationDay = workoutRotationDay(day);
  const level = fitnessLevelInfo(fitnessLevel);
  const available = rotation.filter((id) => (WORKOUT_DIFFICULTY[id] || 1) <= level.value);
  const start = (rotationDay * 2) % available.length;
  const workouts = [available[start], available[(start + 1) % available.length]]
    .map((id) => WORKOUT_LIBRARY.find((workout) => workout.id === id))
    .filter(Boolean);
  return { rotationDay, level, workouts };
}

function renderRadarChart(stats) {
  const cx = 210;
  const cy = 178;
  const radius = 108;
  const labelRadius = 148;
  const angles = STAT_KEYS.map((_, index) => (-Math.PI / 2) + (index * Math.PI * 2) / STAT_KEYS.length);
  const point = (index, value, distance = radius) => {
    const angle = angles[index];
    const scale = value / 100;
    return `${(cx + Math.cos(angle) * distance * scale).toFixed(1)},${(cy + Math.sin(angle) * distance * scale).toFixed(1)}`;
  };
  const grid = [25, 50, 75, 100].map((level) => `<polygon class="radar-grid" points="${STAT_KEYS.map((_, index) => point(index, level)).join(" ")}" />`).join("");
  const axes = STAT_KEYS.map((_, index) => `<line class="radar-axis" x1="${cx}" y1="${cy}" x2="${point(index, 100).split(",")[0]}" y2="${point(index, 100).split(",")[1]}" />`).join("");
  const labels = STAT_KEYS.map((key, index) => {
    const angle = angles[index];
    const x = cx + Math.cos(angle) * labelRadius;
    const y = cy + Math.sin(angle) * labelRadius;
    const anchor = Math.abs(Math.cos(angle)) < 0.25 ? "middle" : Math.cos(angle) > 0 ? "start" : "end";
    return `<text class="radar-label" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}"><tspan>${STAT_LABELS[key]}</tspan><tspan class="radar-value" x="${x.toFixed(1)}" dy="14">${Math.round(stats[key])}</tspan></text>`;
  }).join("");
  const values = STAT_KEYS.map((key) => Math.max(0, Math.min(100, stats[key] || 0)));
  const empty = values.every((value) => value === 0) ? `<text class="radar-empty" x="210" y="184" text-anchor="middle">Complete a quest to reveal your attributes</text>` : "";
  return `<div class="radar-wrap"><svg class="radar-chart" viewBox="0 0 420 340" role="img" aria-labelledby="radar-title radar-desc"><title id="radar-title">Quest attributes</title><desc id="radar-desc">An eight-axis chart showing ${STAT_KEYS.map((key) => `${STAT_LABELS[key]} ${Math.round(stats[key])}`).join(", ")}.</desc>${grid}${axes}<polygon class="radar-area" points="${values.map((value, index) => point(index, value)).join(" ")}" />${values.map((value, index) => `<circle class="radar-point" cx="${point(index, value).split(",")[0]}" cy="${point(index, value).split(",")[1]}" r="3" />`).join("")}${labels}<text class="radar-scale" x="218" y="72">100</text><text class="radar-scale" x="218" y="126">50</text>${empty}</svg></div>`;
}

function renderCompanion() {
  const mainQuest = state.quests.find((quest) => quest.main);
  const progress = mainQuest ? Math.round((mainQuest.progress / mainQuest.target) * 100) : 0;
  const reminderActive = state.reminderUntil && state.reminderUntil > Date.now();
  const message = mainQuest?.status === "completed"
    ? "The gate is open. Your main quest is complete."
    : mainQuest?.status === "missed"
      ? "The path is still here. Start again tomorrow."
      : progress > 0
        ? `You are ${progress}% through today's main quest. Keep going.`
        : "Your main quest is waiting. One small action starts the run.";
  const reminderLabel = reminderActive
    ? `Reminder set for ${new Date(state.reminderUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : typeof Notification !== "undefined" && Notification.permission === "granted" ? "Remind me in 30 min" : "Enable quest reminders";
  return `<section class="panel companion-panel"><div class="panel-heading"><div><p class="eyebrow">YOUR COMPANION</p><h2>Your guide is ready</h2></div><span class="companion-status"><span></span> awake</span></div><div class="companion-stage"><div class="companion-shadow"></div><div class="webgl-avatar" data-avatar-target="companion">${render2DAvatar()}</div></div><div class="companion-dialog"><strong>${message}</strong><p>I'm here to help you return, one quest at a time.</p></div><button class="companion-button" data-action="remind" ${reminderActive ? "disabled" : ""}>${reminderLabel}</button></section>`;
}

function render2DAvatar() {
  const className = state.profile.className;
  const avatarState = state.player.avatarState;
  return `<div class="avatar-3d avatar-3d-${className} avatar-state-${avatarState}" role="img" aria-label="${prettyClass(className)} slime assistant"><div class="slime-bubbles"><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="slime-body"><span class="slime-highlight"></span><span class="slime-core">${iconForClass(className)}</span><span class="slime-eye left"><i></i></span><span class="slime-eye right"><i></i></span><span class="slime-mouth"></span></div><span class="slime-spark">✦</span></div>`;
}

function renderStatsPage() {
  const total = Object.values(state.player.stats).reduce((sum, value) => sum + value, 0);
  return `<div class="stats-page"><div class="stats-page-heading"><div><p class="eyebrow">PLAYER STAT SHEET</p><h1>${prettyClass(state.profile.className)} attributes</h1><p class="muted">Your chart starts empty and grows as you make progress—not when you create an account.</p></div><div class="stats-total"><strong>${Math.round(total)}</strong><small>attribute points</small></div></div><div class="stats-page-chart">${renderRadarChart(state.player.stats)}</div><div class="stats-breakdown">${STAT_KEYS.map((key) => `<div class="stat-row"><span><i class="stat-dot"></i>${STAT_LABELS[key]}</span><strong>${Math.round(state.player.stats[key])}</strong><div class="stat-meter"><span style="width:${Math.min(100, state.player.stats[key])}%"></span></div></div>`).join("")}</div></div>`;
}

function renderCharacterPage() {
  const descriptions = {
    warrior: "The front-line path. Strong sessions build your armor and make the daily gate easier to break.",
    ranger: "The pathfinder route. Cardio and distance sharpen your ability to keep moving when the road changes.",
    mage: "The control path. Mobility and focus turn careful movement into a source of power.",
    allrounder: "The complete build. Every category matters, and the road is deliberately harder.",
  };
  const classQuest = state.quests.find((quest) => quest.kind === "class");
  const rank = rankProgress(state.player.xp, state.profile.className, state.profile.penaltyMode);
  return `<div class="character-page"><div class="character-page-heading"><div><p class="eyebrow">CHARACTER FORGE</p><h1>${prettyClass(state.profile.className)}</h1><p class="muted">This is your home base between quests. Your class avatar and loadout live here; your guide stays on Today.</p></div><span class="level-orb large">${levelProgress(state.player.xp).level}</span></div><div class="character-layout"><section class="character-stage-large"><div class="player-portrait sigil class-${state.profile.className} avatar-${state.player.avatarState}"><span class="glyph" aria-hidden="true">${iconForClass(state.profile.className)}</span><span class="portrait-name">${prettyClass(state.profile.className)}</span></div><div class="character-stage-label"><span>${state.player.avatarState}</span><small>current form</small></div></section><section class="character-details"><div class="character-detail-block"><p class="eyebrow">CURRENT RANK</p><h2>${rank.rank}-Rank</h2><p class="muted">${rank.nextRank ? `${formatValue(rank.current)} / ${formatValue(rank.needed)} XP to ${rank.nextRank}-Rank.` : "Maximum rank reached."}</p><div class="progress-track"><span style="width:${rank.percent}%"></span></div></div><div class="character-detail-block"><p class="eyebrow">TRAINING LEVEL</p><h2>${fitnessLevelInfo(state.profile.fitnessLevel).label} · ${fitnessLevelInfo(state.profile.fitnessLevel).rank}-Rank</h2><p class="muted">Chosen when this adventurer was created. It sets which workouts are recommended.</p></div><div class="character-detail-block"><p class="eyebrow">CLASS CODEX</p><h2>${prettyClass(state.profile.className)}</h2><p class="muted">${descriptions[state.profile.className]}</p></div><div class="character-detail-block"><p class="eyebrow">CLASS TRIAL</p><h3>${classQuest?.title || "No class trial"}</h3><p class="muted">${classQuest?.description || "Choose a class to unlock a trial."}</p><div class="progress-meta"><span>${classQuest?.status === "completed" ? "Complete" : `${formatValue(classQuest?.progress || 0)} / ${formatValue(classQuest?.target || 0)} ${classQuest?.unit || ""}`}</span><strong>${classQuest ? Math.round((classQuest.progress / classQuest.target) * 100) : 0}%</strong></div><div class="progress-track"><span style="width:${classQuest ? Math.round((classQuest.progress / classQuest.target) * 100) : 0}%"></span></div></div><div class="loadout-grid"><div><span>Title</span><strong>Wayfinder</strong></div><div><span>Shield reserve</span><strong>${state.player.shields}</strong></div><div><span>Longest streak</span><strong>${state.player.longestStreak} days</strong></div><div><span>Completed quests</span><strong>${state.player.completed}</strong></div></div></section></div></div>`;
}

function prettyStatus(status) {
  return {
    completed: "Complete",
    missed: "Missed",
    skipped_rest: "Rest day",
    skipped_sick: "Sick day",
  }[status] || "Active";
}

function renderOnboarding() {
  app.innerHTML = `
    <section class="onboarding-shell">
      <div class="onboarding-art">
        <div class="brand-mark">Q<span>/</span>F</div>
        <p class="eyebrow">A local-first dark-fantasy fitness RPG</p>
        <h1>Your fitness journey is the <em>main quest.</em></h1>
        <p class="muted large-copy">Build momentum through small missions, earn your next level, and make consistency feel like a world worth returning to.</p>
        <div class="quote-card"><span>“</span><p>Power is built in the quiet. Every return leaves a mark.</p></div>
      </div>
      <form class="panel onboarding-card" id="onboarding-form">
        <p class="eyebrow">Begin your campaign</p>
        <h2>Create your adventurer</h2>
        <label>What should we call you?<input name="name" required maxlength="32" placeholder="Your name" autofocus /></label>
        <fieldset>
          <legend>Choose your class</legend>
          <div class="choice-grid">
            ${[
              ["warrior", "⚔", "Warrior", "Strength"],
              ["ranger", "➶", "Ranger", "Endurance"],
              ["mage", "✦", "Mage", "Mobility"],
              ["allrounder", "✹", "All-Rounder", "Everything"],
            ].map(([value, icon, label, detail], index) => `
              <label class="choice-card"><input type="radio" name="className" value="${value}" ${index === 0 ? "checked" : ""} /><span class="choice-icon">${icon}</span><strong>${label}</strong><small>${detail}</small></label>
            `).join("")}
          </div>
        </fieldset>
        <label>Current fitness level<select name="fitnessLevel"><option value="beginner">Beginner · E-Rank</option><option value="capable">Capable · D-Rank</option><option value="intermediate">Intermediate · C-Rank</option><option value="proficient">Proficient · B-Rank</option><option value="advanced">Advanced · A-Rank</option><option value="master">Master · S-Rank</option></select></label>
        <fieldset>
          <legend>Penalty intensity <span class="legend-note">changeable later</span></legend>
          <div class="mode-row">
            ${[
              ["soft", "Soft", "Streak pauses"],
              ["balanced", "Balanced", "Streak resets"],
              ["hardcore", "Hardcore", "Bigger stakes"],
            ].map(([value, label, detail], index) => `
              <label class="mode-option"><input type="radio" name="penaltyMode" value="${value}" ${index === 1 ? "checked" : ""} /><span><strong>${label}</strong><small>${detail}</small></span></label>
            `).join("")}
          </div>
        </fieldset>
        <button class="primary-button wide" type="submit">Enter the world <span>→</span></button>
        <p class="fine-print">This prototype stores data only in this browser. Penalties are virtual and can be changed anytime.</p>
      </form>
    </section>
  `;
  document.querySelector("#onboarding-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state = createState({
      name: form.get("name"),
      className: form.get("className"),
      fitnessLevel: form.get("fitnessLevel"),
      penaltyMode: form.get("penaltyMode"),
    });
    sessionActive = true;
    persist(SESSION_KEY, "active");
    saveState();
    render();
  });
}

const REST_MS = 30_000;
const BADGES = { "health-steps": "✓ Health Connect", timer: "⏱ Timer", manual: "Self-reported · ½ XP" };

function proofBadges(quest) {
  const labels = new Set(quest.proofs.map((p) => (p.source === "health-workout" ? (p.verified ? "✓ Watch workout" : BADGES.manual) : BADGES[p.source])));
  labels.delete(undefined); // sets proofs have no badge
  return [...labels].map((label) => `<span class="proof-badge">${label}</span>`).join("");
}

const clock = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};
const sessionMs = (session, now = Date.now()) => Math.min(session.pausedAt ?? now, sessionEnd(session, now)) - session.startedAt - session.pausedMs;
const restLeftMs = (quest, now = Date.now()) => {
  const last = quest.proofs.filter((p) => p.source === "sets").reduce((max, p) => Math.max(max, Date.parse(p.endedAt)), 0);
  return Math.max(0, last + REST_MS - now);
};

function renderSessionControls(session) {
  return `<span class="session-timer" data-timer>${clock(sessionMs(session))}</span><button class="small-button" data-action="${session.pausedAt ? "resume-session" : "pause-session"}">${session.pausedAt ? "Resume" : "Pause"}</button><button class="small-button" data-action="finish-session">Finish</button>`;
}

function renderQuestActions(quest) {
  const session = state.activeSession;
  if (quest.unit === "steps") return state.health?.connected ? `<button class="small-button" data-action="sync-health">Sync steps</button>` : "";
  if (quest.unit === "min") {
    if (session?.questId === quest.id) return renderSessionControls(session);
    return session ? "" : `<button class="small-button" data-action="start-session" data-quest-id="${quest.id}">Start session</button>`;
  }
  if (quest.unit === "sets") {
    const left = restLeftMs(quest);
    return `<button class="small-button" data-action="set-done" data-quest-id="${quest.id}" ${left ? "disabled" : ""}>${left ? `Rest <span data-rest="${quest.id}">${Math.ceil(left / 1000)}s</span>` : "Set done"}</button>`;
  }
  return "";
}

function renderQuest(quest) {
  const percent = Math.round((quest.progress / quest.target) * 100);
  const finished = quest.status !== "active";
  return `
    <article class="quest-card ${quest.kind === "class" ? "class-quest" : quest.main ? "main-quest" : "side-quest"} ${finished ? "is-finished" : ""}">
      <div class="quest-icon">${quest.icon}</div>
      <div class="quest-content">
        <div class="quest-topline"><span class="quest-type">${quest.kind === "class" ? "CLASS TRIAL" : quest.main ? "MAIN QUEST" : "SIDE QUEST"}</span><span class="quest-reward">+${quest.xp} XP · +${quest.coins} ◈</span></div>
        <h3>${quest.title}</h3>
        <p>${quest.description}</p>
        <div class="progress-meta"><span>${finished ? prettyStatus(quest.status) : `${formatValue(quest.progress)} / ${formatValue(quest.target)} ${quest.unit}`}</span><strong>${percent}%</strong></div>
        <div class="progress-track"><span style="width: ${percent}%"></span></div>
        ${finished ? `<div class="quest-result">${quest.status === "completed" ? "✓ Quest complete" : `◌ ${prettyStatus(quest.status)}`}</div>${state.activeSession?.questId === quest.id ? `<div class="quest-actions">${renderSessionControls(state.activeSession)}</div>` : ""}` : `
          <div class="proof-badges">${proofBadges(quest)}</div>
          <div class="quest-actions">${renderQuestActions(quest)}</div>
          ${quest.main ? "" : `<details class="manual-log"><summary class="text-button">Log manually</summary>
            <form class="log-form" data-quest-id="${quest.id}">
              <input aria-label="Amount to log for ${escapeHtml(quest.title)}" name="amount" type="number" min="1" step="1" value="${quest.logStep}" />
              <button class="small-button" type="submit">Log ${quest.unit}</button>
            </form></details>`}
        `}
      </div>
    </article>
  `;
}

function renderWorkoutsPage() {
  const { rotationDay, level, workouts: recommended } = dailyWorkoutRecommendations(state.profile.className, state.day, state.profile.fitnessLevel);
  const recommendedIds = recommended.map((workout) => workout.id);
  const explore = WORKOUT_LIBRARY.filter((workout) => !recommendedIds.includes(workout.id) && (WORKOUT_DIFFICULTY[workout.id] || 1) <= level.value);
  const renderWorkout = (workout, isRecommended = false) => `<article class="workout-card ${isRecommended ? "is-recommended" : ""}"><div class="workout-media"><img src="${workout.image}" alt="${escapeHtml(workout.title)} workout" loading="lazy" /><span>${isRecommended ? "TODAY'S PICK" : workout.category}</span></div><div class="workout-card-body"><div class="workout-card-top"><span class="workout-category">${workout.category}</span><span class="workout-duration">${workout.duration}</span></div><h3>${workout.title}</h3><p>${workout.description}</p><div class="workout-meta"><span>${workoutRank(workout)}-rank target · ${workout.level}</span><span>${workout.exercises}</span></div><div class="workout-card-actions"><a class="workout-start" href="https://www.youtube.com/results?search_query=${encodeURIComponent(workout.videoQuery)}" target="_blank" rel="noopener noreferrer">Find video guide <span>↗</span></a><button class="workout-start" type="button" data-action="workout-info" data-workout-title="${escapeHtml(workout.title)}">Use routine <span>→</span></button></div></div></article>`;
  return `<div class="page-section"><div class="page-heading"><div><p class="eyebrow">TRAINING HALL · ${level.rank}-RANK</p><h1>Workouts</h1><p class="muted">${level.label} level · ${level.description}. Suggestions follow your ${prettyClass(state.profile.className)} role, stay within your rank, and rotate daily.</p></div><span class="page-date">${state.day}</span></div><div class="workout-summary"><div><strong>${recommended.length}</strong><span>today's recommendations</span></div><div><strong>${level.rank}-RANK</strong><span>${level.label} intensity</span></div><div><strong>Day ${rotationDay + 1}/7</strong><span>refreshes at local midnight</span></div></div><div class="section-heading workout-section-heading"><div><p class="eyebrow">FOR YOUR BUILD</p><h2>Recommended today</h2></div><span class="board-count">${prettyClass(state.profile.className)} path</span></div><div class="workout-grid">${recommended.map((workout) => renderWorkout(workout, true)).join("")}</div><div class="section-heading workout-section-heading"><div><p class="eyebrow">UNLOCKED AT ${level.rank}-RANK</p><h2>More ways to train</h2></div><span class="board-count">${explore.length} options</span></div><div class="workout-grid">${explore.map((workout) => renderWorkout(workout)).join("")}</div></div>`;
}

function renderQuestsPage() {
  const dailyQuests = state.quests.filter((quest) => quest.kind !== "class");
  const classQuest = state.quests.find((quest) => quest.kind === "class");
  const mainQuest = dailyQuests.find((quest) => quest.main);
  const completed = state.quests.filter((quest) => quest.status === "completed").length;
  return `<div class="page-section"><div class="page-heading"><div><p class="eyebrow">DAILY QUEST BOARD</p><h1>Quests</h1><p class="muted">A fresh board appears at 12:00 AM in your local timezone: ${state.profile.timeZone || "device time"}.</p></div><span class="board-count">${completed} / ${state.quests.length} complete</span></div><section class="reset-banner panel"><span class="reset-icon">↻</span><div><strong>Next board reset is local midnight</strong><p>Finish what you can today. Tomorrow’s main, side, and class quests are generated separately.</p></div></section><div class="section-heading"><div><p class="eyebrow">MAIN + SIDE QUESTS</p><h2>Today’s objectives</h2></div><span class="board-count">${dailyQuests.filter((quest) => quest.status === "completed").length} / ${dailyQuests.length} complete</span></div><div class="quest-list">${dailyQuests.map(renderQuest).join("")}</div><div class="class-trial-heading"><div><p class="eyebrow">CLASS-BOUND</p><h2>${prettyClass(state.profile.className)} trial</h2></div><span class="board-count">unique path</span></div><div class="quest-list">${classQuest ? renderQuest(classQuest) : ""}</div></div>`;
}

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

function renderConnectCard() {
  if (state.health?.connected) return "";
  const why = "QuestFit reads your steps, workouts and heart rate from Health Connect to verify quests. Nothing leaves your phone.";
  const action = !isNative
    ? `<p class="muted">Health Connect verification is in the Android app.</p>`
    : healthAvailable === false
      ? `<p class="muted">Health Connect isn't available on this device</p><button class="secondary-button" data-action="health-settings">Open Health Connect settings</button>`
      : `<button class="secondary-button" data-action="connect-health">Connect Health</button>`;
  return `<section class="panel connect-card"><div class="panel-heading"><div><p class="eyebrow">VERIFIED QUESTS</p><h2>Connect Health</h2></div></div><p class="muted">${why}</p>${action}<button class="text-button" data-action="privacy-policy">Privacy policy</button></section>`;
}

function renderSyncNow() {
  if (!state.health?.connected) return "";
  const at = state.health.lastSyncAt ? new Date(state.health.lastSyncAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "never";
  return `<div class="sync-row"><button class="text-button" data-action="sync-health">Sync now</button><small class="muted">Last synced at ${at}</small></div>`;
}

function renderDashboard() {
  const progress = levelProgress(state.player.xp);
  const rank = rankProgress(state.player.xp, state.profile.className, state.profile.penaltyMode);
  const mode = modeDetails(state.profile.penaltyMode);
  const dailyQuests = state.quests.filter((quest) => quest.kind !== "class");
  const classQuest = state.quests.find((quest) => quest.kind === "class");
  const mainQuest = dailyQuests.find((quest) => quest.main);
  const completed = dailyQuests.filter((quest) => quest.status === "completed").length;
  const canRest = state.player.restDaysUsed < 2 && state.quests.some((quest) => quest.main && quest.status === "active");
  const canSick = state.player.sickDaysUsed < 2 && state.quests.some((quest) => quest.main && quest.status === "active");
  const recentHistory = state.history.slice(0, 4);
  const story = state.player.completed === 0
    ? "The Ember Gate is quiet. Your first step is enough to wake it."
    : state.player.completed < 3
      ? "A warm current moves through the valley. The path is opening."
      : "The valley remembers your return. A new chapter is forming beyond the ridge.";

  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand-mark small">Q<span>/</span>F</div>
        <div class="topbar-actions"><span class="local-pill"><span class="pulse"></span> LOCAL SAVE</span><button class="icon-button" title="Sign out" data-action="logout">↪</button><button class="icon-button" title="Reset local campaign" data-action="reset">↻</button></div>
      </header>
      <div class="dashboard-grid view-${activeView} ${activeView === "stats" ? "stats-mode" : activeView === "character" ? "character-mode" : ""}">
        <aside class="sidebar">
          <div class="profile-block"><div class="avatar sigil class-${state.profile.className} avatar-${state.player.avatarState}"><span class="glyph" aria-hidden="true">${iconForClass(state.profile.className)}</span></div><div><strong>${escapeHtml(state.profile.name)}</strong><span>Level ${progress.level} ${prettyClass(state.profile.className)}</span></div></div>
          <nav><button class="nav-item ${activeView === "dashboard" ? "active" : ""}" data-view="dashboard" type="button"><span>⌂</span> Dashboard</button><button class="nav-item ${activeView === "workouts" ? "active" : ""}" data-view="workouts" type="button"><span>♜</span> Workouts</button><button class="nav-item ${activeView === "quests" ? "active" : ""}" data-view="quests" type="button"><span>✦</span> Quests <b>${completed}/3</b></button><button class="nav-item ${activeView === "stats" ? "active" : ""}" data-view="stats" type="button"><span>◎</span> Stats</button><button class="nav-item ${activeView === "character" ? "active" : ""}" data-view="character" type="button"><span>◈</span> Character</button></nav>
          <div class="sidebar-footer"><p class="eyebrow">Campaign note</p><p>Consistency beats intensity. Your character can rest and still return stronger.</p></div>
        </aside>
        <section class="main-column" id="today"><div class="page-view ${activeView === "dashboard" ? "is-active" : ""}" id="dashboard-view">
          <div class="page-heading"><div><p class="eyebrow">${state.day} · THE EMBER VALLEY</p><h1>${greeting()}, ${escapeHtml(state.profile.name)}.</h1><p class="muted">Your next decision is small. That is why it matters.</p></div><div class="streak-badge"><span>✦</span><strong>${state.player.streak}</strong><small>day streak</small></div></div>
          <div class="notice"><span>✦</span>${escapeHtml(state.notice)}</div>
          <section class="hero-card"><div class="hero-copy"><p class="eyebrow">GATE 01 · THE FIRST SIGNAL</p><h2>${story}</h2><p class="muted">Complete your main quest to protect your streak. Side quests are optional, but they sharpen the build.</p><div class="hero-stats"><span><strong>${formatValue(state.player.xp)}</strong> total XP</span><span><strong>${formatValue(state.player.coins)}</strong> coins</span><span><strong>${state.player.shields}</strong> shield${state.player.shields === 1 ? "" : "s"} · ${state.player.shieldsUsedThisMonth}/4 used</span></div></div><div class="hero-sigil">${iconForClass(state.profile.className)}</div></section>
          <div class="section-heading"><div><p class="eyebrow">TODAY'S PROGRESS</p><h2>Your next move</h2></div><span class="board-count">${completed} / ${dailyQuests.length} complete</span></div>
          ${renderConnectCard()}<div class="dashboard-cards"><section class="panel dashboard-quest-preview"><div class="panel-heading"><div><p class="eyebrow">MAIN QUEST</p><h2>${mainQuest?.title || "No active main quest"}</h2></div><span class="quest-mini-icon">${mainQuest?.icon || "✦"}</span></div><p class="muted">${mainQuest?.description || "Your next board will appear at local midnight."}</p><div class="progress-meta"><span>${mainQuest?.status === "completed" ? "Complete" : `${formatValue(mainQuest?.progress || 0)} / ${formatValue(mainQuest?.target || 0)} ${mainQuest?.unit || ""}`}</span><strong>${mainQuest ? Math.round((mainQuest.progress / mainQuest.target) * 100) : 0}%</strong></div><div class="progress-track"><span style="width: ${mainQuest ? Math.round((mainQuest.progress / mainQuest.target) * 100) : 0}%"></span></div>${renderSyncNow()}<button class="secondary-button wide dashboard-link" data-view="quests">Open quest board <span>→</span></button></section><section class="panel quick-actions"><div class="panel-heading"><div><p class="eyebrow">QUICK ACTIONS</p><h2>Keep the run moving</h2></div><span class="book-icon">⌁</span></div><button class="quick-action" data-view="workouts"><span>♜</span><span><strong>Log a workout</strong><small>Strength, cardio, or mobility</small></span><b>→</b></button><button class="quick-action" data-view="stats"><span>◎</span><span><strong>View stat sheet</strong><small>See how today changed you</small></span><b>→</b></button><button class="quick-action" data-view="quests"><span>✦</span><span><strong>Review all quests</strong><small>Includes your ${prettyClass(state.profile.className)} trial</small></span><b>→</b></button></section></div>
          <section class="safety-panel"><div><p class="eyebrow">NO PENALTY DAYS</p><h3>Recovery is part of the campaign.</h3><p class="muted">Use a rest or sick day to protect your streak without explaining yourself.</p></div><div class="pass-actions"><button class="secondary-button" data-action="rest" ${canRest ? "" : "disabled"}>Rest day <small>${2 - state.player.restDaysUsed} left</small></button><button class="secondary-button" data-action="sick" ${canSick ? "" : "disabled"}>Sick day <small>${2 - state.player.sickDaysUsed} left</small></button></div></section>
        </div><div class="page-view ${activeView === "workouts" ? "is-active" : ""}" id="workouts-view">${renderWorkoutsPage()}</div><div class="page-view ${activeView === "quests" ? "is-active" : ""}" id="quests-view">${renderQuestsPage()}</div><div class="page-view ${activeView === "stats" ? "is-active" : ""}" id="stats-view">${renderStatsPage()}</div><div class="page-view ${activeView === "character" ? "is-active" : ""}" id="character-view">${renderCharacterPage()}</div></section>
        <aside class="right-column" id="character">
          ${renderCompanion()}
          <section class="panel character-panel"><div class="panel-heading"><div><p class="eyebrow">YOUR CHARACTER</p><h2>${prettyClass(state.profile.className)}</h2></div><span class="level-orb">${progress.level}</span></div><div class="character-display avatar-${state.player.avatarState}">${iconForClass(state.profile.className)}<span class="state-label">${state.player.avatarState}</span></div><div class="level-row"><span>Level ${progress.level} · ${rank.rank}-Rank</span><strong>${rank.nextRank ? `${formatValue(rank.current)} / ${formatValue(rank.needed)} XP` : "Max rank"}</strong></div><div class="progress-track bright"><span style="width: ${rank.percent}%"></span></div><div class="character-meta"><span>Longest streak <strong>${state.player.longestStreak}d</strong></span><span>Completed <strong>${state.player.completed}</strong></span></div></section>
          <section class="panel mode-panel"><div class="panel-heading"><div><p class="eyebrow">CONSEQUENCES</p><h2>${mode.label} mode</h2></div><span class="mode-dot ${state.profile.penaltyMode}"></span></div><p class="muted">${mode.label === "Soft" ? "Your streak pauses when you miss the main quest." : mode.label === "Balanced" ? "Your streak resets and XP is reduced for the next quest." : "Your streak resets, XP is reduced, and coins are at stake."}</p><label class="compact-label">Penalty mode<select id="mode-select"><option value="soft" ${state.profile.penaltyMode === "soft" ? "selected" : ""}>Soft</option><option value="balanced" ${state.profile.penaltyMode === "balanced" ? "selected" : ""}>Balanced</option><option value="hardcore" ${state.profile.penaltyMode === "hardcore" ? "selected" : ""}>Hardcore</option></select></label><button class="danger-button" data-action="miss-main" ${state.quests.some((quest) => quest.main && quest.status === "active") ? "" : "disabled"}>Mark main quest missed</button></section>
          <section class="panel stats-panel" id="stats"><div class="panel-heading"><div><p class="eyebrow">QUEST ATTRIBUTES</p><h2>${prettyClass(state.profile.className)} playing style</h2></div><span class="book-icon">◎</span></div><p class="muted stats-caption">Every logged quest changes the shape of your build.</p>${renderRadarChart(state.player.stats)}</section>
          <section class="panel history-panel" id="chronicle"><div class="panel-heading"><div><p class="eyebrow">CHRONICLE</p><h2>Recent events</h2></div><span class="book-icon">⌁</span></div>${recentHistory.length ? `<div class="history-list">${recentHistory.map((event) => `<div class="history-item"><span class="history-icon ${event.type}">${event.type === "complete" ? "✓" : event.type === "miss" ? "!" : "✦"}</span><div><strong>${escapeHtml(event.title)}</strong><small>${event.type === "complete" ? `+${event.xp} XP · +${event.coins} coins` : event.type === "miss" ? `${prettyClass(event.mode || "balanced")} consequence` : event.type === "shield" ? "Monthly protection used" : "Streak protected"}</small></div></div>`).join("")}</div>` : `<p class="muted empty-history">Your story starts with the first completed quest.</p>`}</section>
        </aside>
      </div>
    </div>
  `;
  bindDashboardEvents();
  mountCompanion();
  startTicker();
}

function mountCompanion() {
  const target = document.querySelector('[data-avatar-target="companion"]');
  const reaction = companionReaction;
  companionReaction = null;
  if (!target) return;
  // Loaded lazily so Three.js never delays the first paint; the 2D slime shows until the model is ready.
  import("./avatar3d.js")
    .then(({ mountAvatar }) => mountAvatar(target, { className: state.profile.className, avatarState: state.player.avatarState, reaction }))
    .catch((error) => console.warn("3D assistant failed to load", error));
}

// Plays a class emblem's move (swing, arrow, spell, burst) from the start.
function castSigil(sigil) {
  if (!sigil) return;
  sigil.classList.remove("is-casting");
  void sigil.offsetWidth; // reflow so a second tap restarts the move
  sigil.classList.add("is-casting");
}

function bindDashboardEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => {
    activeView = button.dataset.view;
    render();
    window.scrollTo(0, 0);
    if (activeView === "character") castSigil(document.querySelector("#character-view .sigil"));
  }));
  document.querySelectorAll(".sigil").forEach((sigil) => sigil.addEventListener("click", () => castSigil(sigil)));
  document.querySelector(".profile-block .sigil")?.addEventListener("pointerenter", (event) => event.pointerType === "mouse" && castSigil(event.currentTarget));
  document.querySelectorAll(".log-form").forEach((form) => form.addEventListener("submit", (event) => {
    event.preventDefault();
    const amount = new FormData(event.currentTarget).get("amount");
    if (logProgress(state, event.currentTarget.dataset.questId, amount).reward) companionReaction = "cheer";
    saveState();
    render();
  }));
  document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => {
    const action = button.dataset.action;
    if (action === "miss-main" && missQuest(state, state.quests.find((quest) => quest.main)?.id).changed) companionReaction = "sad";
    const id = button.dataset.questId;
    if (action === "start-session") startSession(state, id);
    if (action === "pause-session") pauseSession(state);
    if (action === "resume-session") resumeSession(state);
    if (action === "finish-session" && finishSession(state).reward) companionReaction = "cheer";
    if (action === "set-done" && logSet(state, id).reward) companionReaction = "cheer";
    if (action === "sync-health") {
      syncHealth();
      return;
    }
    if (action === "connect-health") {
      connectHealth();
      return;
    }
    if (action === "health-settings") health.openSettings().catch(() => {});
    if (action === "privacy-policy") health.showPrivacyPolicy().catch(() => {});
    if (action === "rest") useDayPass(state, "rest");
    if (action === "sick") useDayPass(state, "sick");
    if (action === "workout-info") {
      state.notice = `${button.dataset.workoutTitle} selected. Use the routine as a guide, then log progress on the matching quest when you are ready.`;
      activeView = "workouts";
    }
    if (action === "remind") {
      requestReminder().then(() => {
        saveState();
        render();
      });
      return;
    }
    if (action === "logout") {
      sessionActive = false;
      persist(SESSION_KEY, null);
      render();
      return;
    }
    if (action === "reset") {
      if (!confirm("Erase this campaign? All progress on this device will be lost.")) return;
      persist(STORAGE_KEY, null);
      persist(SESSION_KEY, null);
      state = null;
      sessionActive = false;
      render();
      return;
    }
    saveState();
    render();
  }));
  document.querySelector("#mode-select")?.addEventListener("change", (event) => {
    state.profile.penaltyMode = event.target.value;
    state.notice = `${modeDetails(event.target.value).label} mode selected for your next consequence.`;
    saveState();
    render();
  });
}

function startTicker() {
  const timer = document.querySelector("[data-timer]");
  const rests = document.querySelectorAll("[data-rest]");
  if (!timer && !rests.length) return;
  tickTimer = setInterval(() => {
    if (timer && state.activeSession) timer.textContent = clock(sessionMs(state.activeSession));
    for (const el of rests) {
      const quest = state.quests.find((q) => q.id === el.dataset.rest);
      const left = quest ? restLeftMs(quest) : 0;
      if (!left) return render(); // rest over: re-enable the button
      el.textContent = `${Math.ceil(left / 1000)}s`;
    }
  }, 1000);
}

async function syncHealth() {
  if (!state?.health?.connected) return;
  const previousDay = state.day;
  state = resetForNewDay(state); // roll the day first so the read and the proof land on today's board
  if (state.day !== previousDay) saveState();
  if (!(await health.isConnected())) {
    if (!state) return;
    state.health.connected = false; // brings the Connect Health card back
    state.notice = "Health Connect access was removed. Timer and sets still work.";
    saveState();
    render();
    return;
  }
  try {
    const now = new Date();
    const dayStart = new Date(`${state.day}T00:00:00`); // local midnight of the board's day
    const reading = await health.readToday(dayStart, now);
    if (!state) return; // campaign was reset mid-sync
    if (applyHealthReading(state, reading, now.getTime()).changed) companionReaction = "cheer";
  } catch (error) {
    if (!state) return;
    state.notice = `Health sync failed: ${error?.message || "unknown error"}`;
  }
  saveState();
  render();
}

async function connectHealth() {
  if (await health.connect()) {
    state.health = { connected: true, lastSyncAt: null };
    state.notice = "Health Connect connected.";
    await syncHealth();
    return;
  }
  state.notice = "Health access wasn't granted. Timer and sets still work.";
  saveState();
  render();
}

function render() {
  clearInterval(tickTimer);
  if (!state || !sessionActive) return renderLogin();
  const previousDay = state.day;
  state = resetForNewDay(state);
  if (state.day !== previousDay) saveState();
  renderDashboard();
}

function scheduleDailyRollover() {
  if (rolloverTimer) clearTimeout(rolloverTimer);
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  rolloverTimer = setTimeout(() => {
    if (state) {
      state = resetForNewDay(state);
      saveState();
      render();
    }
    scheduleDailyRollover();
  }, Math.max(1000, nextMidnight.getTime() - now.getTime() + 250));
}

render();
scheduleDailyRollover();
syncHealth();
health.isAvailable().then((ok) => {
  healthAvailable = ok;
  if (state && sessionActive && !state.health?.connected) render();
});
if (!isNative && "serviceWorker" in navigator) navigator.serviceWorker.register("./notification-worker.js").catch(() => {});

// Android hardware back: return to Today before leaving the app.
App.addListener("resume", () => syncHealth());
App.addListener("backButton", () => {
  if (state && sessionActive && activeView !== "dashboard") {
    activeView = "dashboard";
    render();
  } else {
    App.exitApp();
  }
});

setInterval(() => {
  if (!state?.reminderUntil || state.reminderUntil > Date.now()) return;
  if (!isNative && !state.reminderNotified && typeof Notification !== "undefined" && Notification.permission === "granted" && !navigator.serviceWorker.controller) {
    new Notification("QuestFit reminder", { body: "Your daily quest is waiting for you." });
  }
  if (state.reminderNotified) return;
  state.reminderNotified = true;
  state.reminderUntil = null;
  state.notice = "Your companion is calling you back to the quest.";
  saveState();
  render();
}, 30_000);
