import { todayKey } from "./time.js";

const TIMED = ["timer", "health-workout"];
const MIN_REST_MS = 30000;

const no = (reason) => ({ ok: false, reason });

export function acceptProof(quest, proof, existingProofs, now, timeZone) {
  const { source, meta = {} } = proof;
  const start = Date.parse(proof.startedAt);
  const end = Date.parse(proof.endedAt);
  if (!quest.verify.includes(source) || (source === "manual" && quest.main)) return no("This proof type can't complete this quest.");
  if (!(end <= now) || todayKey(new Date(start), timeZone) !== quest.day) return no("Proof must be from today.");
  if (source === "timer" && proof.amount > Math.floor((end - start - (meta.pausedMs || 0)) / 60000)) return no("Timer minutes exceed the time actually spent.");
  if (TIMED.includes(source) && existingProofs.some((p) => TIMED.includes(p.source) && start < Date.parse(p.endedAt) && Date.parse(p.startedAt) < end)) return no("That time is already counted on another proof.");
  if (source === "sets") {
    const last = Math.max(-Infinity, ...quest.proofs.filter((p) => p.source === "sets").map((p) => Date.parse(p.startedAt)));
    if (start < last + MIN_REST_MS) return no("Rest at least 30 seconds between sets.");
  }
  const replaces = source === "health-steps" && quest.proofs.some((p) => p.id === proof.id);
  if (!replaces && existingProofs.some((p) => p.id === proof.id)) return no("This record was already used.");
  const verified = source === "manual" ? false : source === "health-workout" ? meta.heartRateSamples > 0 && !!meta.knownType : true;
  if (!verified && source === "health-workout" && quest.main) return no("The main quest needs a verified workout.");
  return { ok: true, proof: { ...proof, verified }, ...(replaces && { replaces }) };
}

export function progressOf(quest) {
  return Math.min(quest.proofs.reduce((sum, p) => sum + p.amount, 0), quest.target);
}

export function rewardFor(quest) {
  const sum = (verified) => quest.proofs.filter((p) => p.verified === verified).reduce((s, p) => s + p.amount, 0);
  const v = Math.min(sum(true), quest.target);
  const s = Math.min(sum(false), quest.target - v);
  const part = (total) => Math.floor((total * (v + s / 2)) / quest.target);
  return { xp: part(quest.xp), coins: part(quest.coins) };
}

const CATEGORIES = {
  cardio: ["running", "runningTreadmill", "walking", "cycling", "bikingStationary", "hiking", "elliptical", "rowing", "rowingMachine", "swimming", "swimmingPool", "swimmingOpenWater"],
  strength: ["strengthTraining", "traditionalStrengthTraining", "functionalStrengthTraining", "weightlifting", "calisthenics"],
  mobility: ["yoga", "pilates", "stretching", "flexibility"],
};

export function workoutCategory(type) {
  const category = Object.keys(CATEGORIES).find((name) => CATEGORIES[name].includes(type));
  return { category: category || "cardio", known: !!category };
}
