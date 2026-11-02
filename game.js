export const QUEST_BLUEPRINTS = {
  warrior: [
    { key: "iron-gate", category: "strength", icon: "⚔", title: "Break the Iron Gate", description: "Complete a focused strength session and clear the first gate.", target: 30, unit: "min", logStep: 10, xp: 100, coins: 20, main: true },
    { key: "shield-march", category: "steps", icon: "✦", title: "March the Ember Road", description: "Walk enough to carry your supplies through the valley.", target: 6000, unit: "steps", logStep: 1000, xp: 50, coins: 10, main: false },
    { key: "armor", category: "mobility", icon: "◌", title: "Brace the Shield", description: "Give your body ten calm minutes of mobility work.", target: 10, unit: "min", logStep: 5, xp: 40, coins: 8, main: false },
    { key: "training-sigil", category: "strength", icon: "♜", title: "Forge a Training Sigil", description: "Complete three deliberate strength sets to prove your discipline.", target: 3, unit: "sets", logStep: 1, xp: 80, coins: 15, kind: "class" },
  ],
  ranger: [
    { key: "windline", category: "cardio", icon: "➶", title: "Run the Windline", description: "Build enough momentum to reach the lookout before dusk.", target: 20, unit: "min", logStep: 10, xp: 100, coins: 20, main: true },
    { key: "wilds", category: "steps", icon: "✦", title: "Map the Wilds", description: "Cover the hidden paths and reveal a safer route forward.", target: 8000, unit: "steps", logStep: 1000, xp: 60, coins: 12, main: false },
    { key: "bowstring", category: "mobility", icon: "◌", title: "String the Bow", description: "Keep your hips and shoulders ready for the next trail.", target: 10, unit: "min", logStep: 5, xp: 40, coins: 8, main: false },
    { key: "far-sight", category: "cardio", icon: "◉", title: "Unlock Far-Sight", description: "Complete a brisk interval session and sharpen your range.", target: 15, unit: "min", logStep: 5, xp: 80, coins: 15, kind: "class" },
  ],
  mage: [
    { key: "leyline", category: "mobility", icon: "✦", title: "Channel the Leyline", description: "Move with control and restore your connection to the valley.", target: 20, unit: "min", logStep: 5, xp: 100, coins: 20, main: true },
    { key: "momentum", category: "cardio", icon: "◌", title: "Gather Momentum", description: "Raise your energy with a short, steady cardio session.", target: 15, unit: "min", logStep: 5, xp: 55, coins: 10, main: false },
    { key: "runes", category: "steps", icon: "⌁", title: "Trace the Runes", description: "Walk the old circuit and charge the first waystone.", target: 5000, unit: "steps", logStep: 1000, xp: 45, coins: 9, main: false },
    { key: "arcane-flow", category: "mobility", icon: "☼", title: "Cast Arcane Flow", description: "Hold a calm mobility practice and restore your focus.", target: 10, unit: "min", logStep: 5, xp: 80, coins: 15, kind: "class" },
  ],
  allrounder: [
    { key: "champion-circuit", category: "strength", icon: "✹", title: "Conquer the Champion Circuit", description: "Complete a demanding strength session worthy of the all-rounder path.", target: 45, unit: "min", logStep: 10, xp: 125, coins: 25, main: true },
    { key: "long-road", category: "steps", icon: "✦", title: "Walk the Long Road", description: "Cover more ground than any single-discipline class would dare.", target: 10000, unit: "steps", logStep: 1000, xp: 70, coins: 14, main: false },
    { key: "storm-run", category: "cardio", icon: "➶", title: "Outrun the Storm", description: "Build a deep cardio reserve with a sustained effort.", target: 30, unit: "min", logStep: 10, xp: 70, coins: 14, main: false },
    { key: "fourfold-mastery", category: "mobility", icon: "✺", title: "Master the Fourfold Path", description: "Finish a longer mobility practice to keep every part of the build ready.", target: 20, unit: "min", logStep: 5, xp: 100, coins: 20, kind: "class" },
  ],
};

const MODES = {
  soft: { label: "Soft", xpDebuff: 0, coinLoss: 0, avatar: "normal", streak: "pause" },
  balanced: { label: "Balanced", xpDebuff: 25, coinLoss: 0, avatar: "tired", streak: "reset" },
  hardcore: { label: "Hardcore", xpDebuff: 50, coinLoss: 0.05, avatar: "injured", streak: "reset" },
};
const MAX_MONTHLY_SHIELD_USES = 4;
export const STAT_KEYS = ["strength", "cardio", "mobility", "endurance", "discipline", "recovery", "agility", "versatility"];
const QUEST_STAT_MAP = { strength: "strength", cardio: "cardio", mobility: "mobility", steps: "endurance" };
export const FITNESS_LEVELS = {
  beginner: { label: "Beginner", rank: "E", value: 1, description: "Low-intensity foundations" },
  capable: { label: "Capable", rank: "D", value: 2, description: "Controlled basic sessions" },
  intermediate: { label: "Intermediate", rank: "C", value: 3, description: "Steady training volume" },
  proficient: { label: "Proficient", rank: "B", value: 4, description: "Demanding structured work" },
  advanced: { label: "Advanced", rank: "A", value: 5, description: "High-intensity structured work" },
  master: { label: "Master", rank: "S", value: 6, description: "High-intensity mastery" },
};

export const RANK_THRESHOLDS = { E: 0, D: 8000, C: 18000, B: 32000, A: 50000, S: 75000 };
export const CLASS_RANK_MULTIPLIERS = { mage: 1, ranger: 1.05, warrior: 1.1, allrounder: 1.25 };
export const PENALTY_RANK_MULTIPLIERS = { soft: 1, balanced: 1.05, hardcore: 1.1 };
const FITNESS_LEVEL_ALIASES = { regular: "capable", athlete: "proficient" };

export function fitnessLevelInfo(level) {
  return FITNESS_LEVELS[FITNESS_LEVEL_ALIASES[level] || level] || FITNESS_LEVELS.beginner;
}

export function makeStats() {
  return Object.fromEntries(STAT_KEYS.map((key) => [key, 0]));
}

export function currentTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function todayKey(date = new Date(), timeZone = currentTimeZone()) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return todayKey(date, "UTC");
  }
}

export function workoutRotationDay(day) {
  const [year, month, date] = day.split("-").map(Number);
  const dayNumber = Math.floor(Date.UTC(year, month - 1, date) / 86400000);
  return ((dayNumber % 7) + 7) % 7;
}

export function createState({ name, className, fitnessLevel, penaltyMode } = {}) {
  const timeZone = currentTimeZone();
  const day = todayKey(new Date(), timeZone);
  return {
    day,
    profile: {
      name: name?.trim() || "Adventurer",
      className: className || "warrior",
      fitnessLevel: fitnessLevel || "beginner",
      penaltyMode: penaltyMode || "balanced",
      timeZone,
    },
    questVersion: 2,
    player: {
      xp: 0,
      coins: 60,
      streak: 0,
      longestStreak: 0,
      shields: 1,
      shieldsUsedThisMonth: 0,
      shieldMonth: day.slice(0, 7),
      avatarState: "normal",
      xpDebuffPct: 0,
      completed: 0,
      missed: 0,
      restDaysUsed: 0,
      sickDaysUsed: 0,
      passMonth: day.slice(0, 7),
      stats: makeStats(),
      statsVersion: 2,
    },
    quests: makeQuests(day, className || "warrior"),
    history: [],
    comboAwarded: false,
    notice: "Your first mission is waiting.",
  };
}

export function makeQuests(day = todayKey(), className = "warrior") {
  return (QUEST_BLUEPRINTS[className] || QUEST_BLUEPRINTS.warrior).map((quest) => ({
    ...quest,
    kind: quest.kind || (quest.main ? "main" : "side"),
    id: `${day}-${quest.key}`,
    progress: 0,
    statProgressAwarded: 0,
    status: "active",
  }));
}

export function modeDetails(mode) {
  return MODES[mode] || MODES.balanced;
}

export function levelForXp(xp) {
  return Math.floor(Math.max(0, xp) / 250) + 1;
}

export function levelProgress(xp) {
  const level = levelForXp(xp);
  const floor = (level - 1) * 250;
  return { level, current: xp - floor, needed: 250, percent: Math.min(100, ((xp - floor) / 250) * 100) };
}

export function rankProgress(xp, className = "warrior", penaltyMode = "balanced") {
  const safeXp = Math.max(0, xp);
  const multiplier = (CLASS_RANK_MULTIPLIERS[className] || 1) * (PENALTY_RANK_MULTIPLIERS[penaltyMode] || 1.05);
  const thresholds = Object.fromEntries(Object.entries(RANK_THRESHOLDS).map(([rank, threshold]) => [rank, Math.ceil(threshold * multiplier)]));
  const ranks = Object.keys(thresholds);
  let rankIndex = 0;
  for (let index = 0; index < ranks.length; index += 1) {
    if (safeXp >= thresholds[ranks[index]]) rankIndex = index;
  }
  const rank = ranks[rankIndex];
  const nextRank = ranks[rankIndex + 1] || null;
  const currentThreshold = thresholds[rank];
  const nextThreshold = nextRank ? thresholds[nextRank] : currentThreshold;
  const needed = nextThreshold - currentThreshold;
  return {
    rank,
    nextRank,
    current: nextRank ? safeXp - currentThreshold : 0,
    needed,
    percent: nextRank ? Math.min(100, ((safeXp - currentThreshold) / needed) * 100) : 100,
    threshold: currentThreshold,
    nextThreshold,
    multiplier,
  };
}

export function resetForNewDay(state, day) {
  state.profile ??= {};
  state.profile.timeZone = currentTimeZone();
  day = day || todayKey(new Date(), state.profile.timeZone);
  if (state.player.statsVersion !== 2) {
    state.player.stats = makeStats();
    state.player.statsVersion = 2;
    state.quests = state.quests.map((quest) => ({ ...quest, statProgressAwarded: 0 }));
  }
  state.player.stats ??= makeStats();
  for (const key of STAT_KEYS) state.player.stats[key] ??= 0;
  state.player.shieldsUsedThisMonth ??= 0;
  state.player.shieldMonth ??= state.day.slice(0, 7);
  if (state.questVersion !== 2) {
    state.quests = makeQuests(state.day, state.profile.className);
    state.questVersion = 2;
    state.notice = "Your class has shaped a new quest board.";
  }
  if (state.day === day) return state;
  let missedDays = 0;
  // Only roll forward; a clock or time zone moving back just rebuilds the board.
  if (day > state.day) {
    const yesterdayMain = state.quests.find((quest) => quest.main && quest.status === "active");
    if (yesterdayMain) {
      missQuest(state, yesterdayMain.id);
      missedDays += 1;
    }
    for (let skipped = nextDay(state.day); skipped < day; skipped = nextDay(skipped)) {
      resetShieldMonth(state, skipped);
      applyMiss(state, "Main quest (day not opened)");
      missedDays += 1;
    }
  }
  state.day = day;
  state.quests = makeQuests(day, state.profile.className);
  state.comboAwarded = false;
  state.notice = missedDays
    ? `${missedDays} missed main quest${missedDays === 1 ? "" : "s"} counted. ${state.notice}`
    : "A new chapter begins. Your quests are ready.";
  if (state.player.passMonth !== day.slice(0, 7)) {
    state.player.passMonth = day.slice(0, 7);
    state.player.restDaysUsed = 0;
    state.player.sickDaysUsed = 0;
  }
  resetShieldMonth(state, day);
  return state;
}

function nextDay(day) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function resetShieldMonth(state, day) {
  if (state.player.shieldMonth === day.slice(0, 7)) return;
  state.player.shieldMonth = day.slice(0, 7);
  state.player.shieldsUsedThisMonth = 0;
}

function addHistory(state, entry) {
  state.history.unshift({ at: new Date().toISOString(), ...entry });
  state.history = state.history.slice(0, 12);
}

function award(state, quest) {
  const multiplier = 1 - state.player.xpDebuffPct / 100;
  const xpEarned = Math.max(0, Math.floor(quest.xp * multiplier));
  state.player.xp += xpEarned;
  state.player.coins += quest.coins;
  state.player.completed += 1;
  addHistory(state, { type: "complete", title: quest.title, xp: xpEarned, coins: quest.coins });
  return { xpEarned, coins: quest.coins };
}

function updateQuestStats(state, quest) {
  const progressRatio = Math.min(1, quest.progress / quest.target);
  const statKey = QUEST_STAT_MAP[quest.category];
  const statTarget = quest.kind === "class" ? 30 : 20;
  const statEarned = Math.floor(progressRatio * statTarget);
  const statDelta = statEarned - (quest.statProgressAwarded || 0);
  if (statKey && statDelta > 0) state.player.stats[statKey] = Math.min(100, state.player.stats[statKey] + statDelta);
  quest.statProgressAwarded = statEarned;
  const disciplineTarget = quest.main ? 12 : 5;
  const disciplineEarned = Math.floor(progressRatio * disciplineTarget);
  const disciplineDelta = disciplineEarned - (quest.disciplineProgressAwarded || 0);
  if (disciplineDelta > 0) state.player.stats.discipline = Math.min(100, state.player.stats.discipline + disciplineDelta);
  quest.disciplineProgressAwarded = disciplineEarned;
  if (quest.kind === "class") {
    const versatilityEarned = Math.floor(progressRatio * 8);
    const versatilityDelta = versatilityEarned - (quest.versatilityProgressAwarded || 0);
    if (versatilityDelta > 0) state.player.stats.versatility = Math.min(100, state.player.stats.versatility + versatilityDelta);
    quest.versatilityProgressAwarded = versatilityEarned;
  }
}

export function completeQuest(state, questId) {
  const quest = state.quests.find((item) => item.id === questId);
  if (!quest || quest.status !== "active") return { changed: false };
  quest.progress = quest.target;
  updateQuestStats(state, quest);
  quest.status = "completed";
  const reward = award(state, quest);
  if (quest.main) {
    // A miss penalty lasts until the next main quest is done.
    state.player.avatarState = "normal";
    state.player.xpDebuffPct = 0;
    state.player.streak += 1;
    state.player.longestStreak = Math.max(state.player.longestStreak, state.player.streak);
  }
  const dailyQuests = state.quests.filter((item) => item.kind !== "class");
  if (!state.comboAwarded && dailyQuests.every((item) => item.status === "completed")) {
    state.comboAwarded = true;
    state.player.xp += 25;
    state.player.coins += 10;
    addHistory(state, { type: "combo", title: "Quest combo", xp: 25, coins: 10 });
  }
  state.notice = `${quest.title} complete. +${reward.xpEarned} XP and +${reward.coins} coins.`;
  return { changed: true, quest, reward };
}

export function logProgress(state, questId, amount) {
  const quest = state.quests.find((item) => item.id === questId);
  const value = Number(amount);
  if (!quest || quest.status !== "active" || !Number.isFinite(value) || value <= 0) return { changed: false };
  quest.progress = Math.min(quest.target, quest.progress + value);
  updateQuestStats(state, quest);
  if (quest.progress >= quest.target) return completeQuest(state, questId);
  state.notice = `${quest.title}: ${formatValue(quest.progress)} / ${formatValue(quest.target)} ${quest.unit}.`;
  return { changed: true, quest };
}

export function missQuest(state, questId) {
  const quest = state.quests.find((item) => item.id === questId);
  if (!quest || !quest.main || quest.status !== "active") return { changed: false };
  quest.status = "missed";
  return { ...applyMiss(state, quest.title), quest };
}

function applyMiss(state, title) {
  const mode = modeDetails(state.profile.penaltyMode);
  state.player.missed += 1;
  if (mode.streak === "reset" && state.player.shields > 0 && state.player.shieldsUsedThisMonth < MAX_MONTHLY_SHIELD_USES) {
    state.player.shields -= 1;
    state.player.shieldsUsedThisMonth += 1;
    state.player.avatarState = "normal";
    state.player.xpDebuffPct = 0;
    addHistory(state, { type: "shield", title: "Shield absorbed the loss" });
    state.notice = `Shield used. Your streak survives; ${MAX_MONTHLY_SHIELD_USES - state.player.shieldsUsedThisMonth} shield use${MAX_MONTHLY_SHIELD_USES - state.player.shieldsUsedThisMonth === 1 ? "" : "s"} left this month.`;
    return { changed: true, shieldUsed: true };
  }
  state.player.avatarState = mode.avatar;
  state.player.xpDebuffPct = mode.xpDebuff;
  if (mode.streak === "reset") state.player.streak = 0;
  if (mode.coinLoss) state.player.coins = Math.max(0, Math.floor(state.player.coins * (1 - mode.coinLoss)));
  addHistory(state, { type: "miss", title, mode: state.profile.penaltyMode });
  state.notice = mode.streak === "pause"
    ? "The quest was missed. Your streak pauses, and your character is safe."
    : `The quest was missed. ${mode.label} penalty applied until your next main quest.`;
  return { changed: true };
}

export function useDayPass(state, kind) {
  const quest = state.quests.find((item) => item.main && item.status === "active");
  const field = kind === "sick" ? "sickDaysUsed" : "restDaysUsed";
  if (!quest || state.player[field] >= 2) return { changed: false };
  quest.status = kind === "sick" ? "skipped_sick" : "skipped_rest";
  state.player[field] += 1;
  state.player.avatarState = "normal";
  state.player.xpDebuffPct = 0;
  state.player.stats.recovery = Math.min(100, state.player.stats.recovery + 2);
  addHistory(state, { type: kind, title: `${kind} day` });
  state.notice = `${kind === "sick" ? "Sick" : "Rest"} day used. Streak protected with no penalty.`;
  return { changed: true, quest };
}

export function formatValue(value) {
  return new Intl.NumberFormat().format(value);
}
