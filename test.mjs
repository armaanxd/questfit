import assert from "node:assert/strict";
import { addProof, applyHealthReading, createState, finishSession, fitnessLevelInfo, levelForXp, logProgress, logSet, makeQuests, missQuest, pauseSession, rankProgress, resetForNewDay, resumeSession, startSession, todayKey, useDayPass, workoutRotationDay } from "./game.js";
import { workoutCategory, acceptProof, progressOf, rewardFor } from "./verify.js";

const midnightBoundary = new Date("2026-10-10T00:30:00.000Z");
assert.equal(todayKey(midnightBoundary, "Asia/Kolkata"), "2026-10-10");
assert.equal(todayKey(midnightBoundary, "America/Los_Angeles"), "2026-10-09");
assert.notEqual(workoutRotationDay("2026-10-09"), workoutRotationDay("2026-10-10"));
assert.equal(workoutRotationDay("2026-10-09"), workoutRotationDay("2026-10-16"));
assert.equal(fitnessLevelInfo("beginner").rank, "E");
assert.equal(fitnessLevelInfo("advanced").rank, "A");
assert.equal(fitnessLevelInfo("master").rank, "S");
assert.equal(fitnessLevelInfo("regular").label, "Capable");

const mainOf = (s) => s.quests.find((quest) => quest.main);
// Completes the main quest with a timer on the quest's own day (manual no longer counts on main).
const finishMain = (s) => {
  const quest = mainOf(s);
  const start = new Date(`${quest.day}T10:00:00`).getTime();
  startSession(s, quest.id, start);
  return finishSession(s, start + quest.target * 60000);
};

const rolloverState = createState({ className: "mage" });
const rolloverQuestId = rolloverState.quests[1].id;
logProgress(rolloverState, rolloverQuestId, 5);
resetForNewDay(rolloverState, "2099-01-02");
assert.equal(rolloverState.day, "2099-01-02");
assert.equal(rolloverState.quests[0].progress, 0);
assert.notEqual(rolloverState.quests[0].id, rolloverQuestId);

assert.notEqual(createState({ className: "warrior" }).quests[0].title, createState({ className: "ranger" }).quests[0].title);
assert.notEqual(createState({ className: "ranger" }).quests[0].title, createState({ className: "mage" }).quests[0].title);
assert.equal(createState({ className: "warrior" }).quests.filter((quest) => quest.kind === "class").length, 1);
assert.equal(createState({ className: "ranger" }).quests.find((quest) => quest.kind === "class").title, "Unlock Far-Sight");
const allRounder = createState({ className: "allrounder" });
assert.equal(allRounder.quests.length, 4);
assert.equal(allRounder.quests.find((quest) => quest.main).target, 45);
assert.equal(allRounder.quests.find((quest) => quest.kind === "class").title, "Master the Fourfold Path");

const statState = createState({ className: "warrior" });
const startingStrength = statState.player.stats.strength;
finishMain(statState);
assert.ok(statState.player.stats.strength > startingStrength);

const state = createState({ name: "Test", penaltyMode: "balanced" });
const main = state.quests.find((quest) => quest.main);

finishMain(state);
assert.equal(main.status, "completed");
assert.equal(state.player.streak, 1);
assert.equal(state.player.xp, 100);

const penaltyState = createState({ penaltyMode: "hardcore" });
const penaltyMain = penaltyState.quests.find((quest) => quest.main);
penaltyState.player.streak = 3;
missQuest(penaltyState, penaltyMain.id);
assert.equal(penaltyMain.status, "missed");
assert.equal(penaltyState.player.streak, 3);
assert.equal(penaltyState.player.xpDebuffPct, 0);
assert.equal(penaltyState.player.shields, 0);
assert.equal(penaltyState.player.shieldsUsedThisMonth, 1);

const recoveryState = createState();
const recoveryMain = recoveryState.quests.find((quest) => quest.main);
useDayPass(recoveryState, "rest");
assert.equal(recoveryMain.status, "skipped_rest");
assert.equal(recoveryState.player.streak, 0);

const streakState = createState({ penaltyMode: "balanced" });
streakState.day = "2099-03-01";
for (const day of ["2099-03-01", "2099-03-02", "2099-03-03"]) {
  resetForNewDay(streakState, day);
  finishMain(streakState);
}
assert.equal(streakState.player.streak, 3);
resetForNewDay(streakState, "2099-03-04");
resetForNewDay(streakState, "2099-03-05"); // 03-04 main left undone: the shield absorbs it
assert.equal(streakState.player.streak, 3);
assert.equal(streakState.player.shields, 0);
resetForNewDay(streakState, "2099-03-06"); // 03-05 undone, no shield left
assert.equal(streakState.player.streak, 0);
assert.equal(streakState.player.longestStreak, 3);
assert.equal(streakState.player.xpDebuffPct, 25);
assert.equal(streakState.player.avatarState, "tired");
finishMain(streakState); // the penalty carries into the next day's main quest, then clears
assert.equal(streakState.player.streak, 1);
assert.equal(streakState.player.xpDebuffPct, 0);
assert.equal(streakState.player.avatarState, "normal");

const awayState = createState({ penaltyMode: "balanced" });
awayState.day = "2099-03-01";
finishMain(awayState);
awayState.player.streak = 5;
const missedBefore = awayState.player.missed;
resetForNewDay(awayState, "2099-03-04"); // 03-02 and 03-03 never opened: shield, then reset
assert.equal(awayState.player.missed, missedBefore + 2);
assert.equal(awayState.player.shields, 0);
assert.equal(awayState.player.streak, 0);

const softAway = createState({ penaltyMode: "soft" });
softAway.day = "2099-03-01";
finishMain(softAway);
resetForNewDay(softAway, "2099-03-05");
assert.equal(softAway.player.streak, 1);

const restState = createState({ penaltyMode: "balanced" });
restState.day = "2099-03-01";
finishMain(restState);
resetForNewDay(restState, "2099-03-02");
useDayPass(restState, "rest");
resetForNewDay(restState, "2099-03-03");
assert.equal(restState.player.streak, 1);
assert.equal(restState.player.shields, 1);

const backwards = createState({ penaltyMode: "balanced" });
backwards.day = "2099-03-02";
backwards.player.streak = 4;
resetForNewDay(backwards, "2099-03-01"); // clock moved back: no miss
assert.equal(backwards.player.streak, 4);
assert.equal(backwards.player.shields, 1);

assert.equal(levelForXp(0), 1);
assert.equal(levelForXp(250), 2);
assert.equal(rankProgress(0, "mage", "soft").nextThreshold, 8000);
assert.equal(rankProgress(7999, "allrounder", "hardcore").rank, "E");
assert.equal(rankProgress(11000, "allrounder", "hardcore").rank, "D");
assert.ok(rankProgress(0, "allrounder", "hardcore").nextThreshold > rankProgress(0, "warrior", "soft").nextThreshold);
const at = (h, m = 0, s = 0) => new Date(2026, 9, 20, h, m, s).getTime(); // local time, so todayKey gives 2026-10-20
const iso = (ms) => new Date(ms).toISOString();
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const vq = (over = {}) => ({ day: "2026-10-20", unit: "min", target: 30, xp: 100, coins: 20, main: false, verify: ["health-workout", "timer", "manual"], proofs: [], ...over });
const vp = (over = {}) => ({ id: "t1", source: "timer", amount: 10, startedAt: iso(at(10)), endedAt: iso(at(10, 10)), meta: { pausedMs: 0 }, ...over });
const NOON = at(12);

// source and main-quest rules
assert.equal(acceptProof(vq({ main: true, verify: ["health-workout", "timer"] }), vp({ source: "manual" }), [], NOON, TZ).ok, false);
assert.equal(acceptProof(vq({ unit: "steps", verify: ["health-steps", "manual"] }), vp(), [], NOON, TZ).ok, false);
// dates
assert.equal(acceptProof(vq(), vp({ startedAt: iso(at(13)), endedAt: iso(at(13, 10)) }), [], NOON, TZ).ok, false);
assert.equal(acceptProof(vq(), vp({ startedAt: iso(at(10) - 86400000), endedAt: iso(at(10, 10) - 86400000) }), [], NOON, TZ).ok, false);
// timer limits
assert.equal(acceptProof(vq(), vp({ amount: 11 }), [], NOON, TZ).ok, false);
assert.equal(acceptProof(vq(), vp({ amount: 9, meta: { pausedMs: 120000 } }), [], NOON, TZ).ok, false);
assert.equal(acceptProof(vq(), vp({ amount: 8, meta: { pausedMs: 120000 } }), [], NOON, TZ).ok, true);
// no overlapping time-based proofs (Review Focus 1)
const running = vp({ id: "t0" });
assert.equal(acceptProof(vq(), vp({ id: "t2", startedAt: iso(at(10, 5)), endedAt: iso(at(10, 15)) }), [running], NOON, TZ).ok, false);
assert.equal(acceptProof(vq(), vp({ id: "hc-1", source: "health-workout", startedAt: iso(at(10, 5)), endedAt: iso(at(10, 15)), meta: { heartRateSamples: 30, knownType: true } }), [running], NOON, TZ).ok, false);
assert.equal(acceptProof(vq(), vp({ id: "t3", startedAt: iso(at(10, 10)), endedAt: iso(at(10, 20)) }), [running], NOON, TZ).ok, true);
// set spacing
const setQ = vq({ unit: "sets", target: 3, verify: ["sets", "manual"] });
const set1 = { id: "s1", source: "sets", amount: 1, startedAt: iso(at(10)), endedAt: iso(at(10)), meta: {} };
setQ.proofs = [set1];
assert.equal(acceptProof(setQ, { ...set1, id: "s2", startedAt: iso(at(10, 0, 20)), endedAt: iso(at(10, 0, 20)) }, [set1], NOON, TZ).ok, false);
assert.equal(acceptProof(setQ, { ...set1, id: "s2", startedAt: iso(at(10, 0, 30)), endedAt: iso(at(10, 0, 30)) }, [set1], NOON, TZ).ok, true);
// health record used once across the board, steps replace on the same quest
const hc = vp({ id: "hc-9", source: "health-workout", meta: { heartRateSamples: 30, knownType: true } });
assert.equal(acceptProof(vq(), { ...hc, startedAt: iso(at(11)), endedAt: iso(at(11, 10)) }, [hc], NOON, TZ).ok, false);
const stepsQ = vq({ unit: "steps", target: 6000, verify: ["health-steps", "manual"] });
const oldSteps = { id: "health-steps-2026-10-20", source: "health-steps", amount: 3000, startedAt: iso(at(0)), endedAt: iso(at(9)), meta: {} };
stepsQ.proofs = [oldSteps];
const stepResult = acceptProof(stepsQ, { ...oldSteps, amount: 4000, endedAt: iso(at(11)) }, [oldSteps], NOON, TZ);
assert.equal(stepResult.ok, true);
assert.equal(stepResult.replaces, true);
// verified flag
assert.equal(acceptProof(vq(), vp({ source: "manual" }), [], NOON, TZ).proof.verified, false);
assert.equal(acceptProof(vq(), { ...hc, meta: { heartRateSamples: 0, knownType: true } }, [], NOON, TZ).proof.verified, false);
assert.equal(acceptProof(vq(), hc, [], NOON, TZ).proof.verified, true);
assert.equal(acceptProof(vq({ main: true, verify: ["health-workout", "timer"] }), { ...hc, meta: { heartRateSamples: 0, knownType: true } }, [], NOON, TZ).ok, false);
// progress and reward split
assert.equal(progressOf(vq({ proofs: [vp({ amount: 20 }), vp({ amount: 20 })] })), 30);
assert.deepEqual(rewardFor(vq({ proofs: [{ amount: 30, verified: true }] })), { xp: 100, coins: 20 });
assert.deepEqual(rewardFor(vq({ proofs: [{ amount: 30, verified: false }] })), { xp: 50, coins: 10 });
assert.deepEqual(rewardFor(vq({ proofs: [{ amount: 15, verified: true }, { amount: 15, verified: false }] })), { xp: 75, coins: 15 });
assert.deepEqual(rewardFor(vq({ proofs: [{ amount: 30, verified: true }, { amount: 10, verified: false }] })), { xp: 100, coins: 20 });
// Step quests: synced steps are the whole day's count, so hand-logged steps only count above them, not on top.
const stepProofs = (synced, logged) => vq({ unit: "steps", target: 6000, proofs: [{ source: "health-steps", amount: synced, verified: true }, { source: "manual", amount: logged, verified: false }] });
assert.equal(progressOf(stepProofs(4000, 1000)), 4000);
assert.equal(progressOf(stepProofs(1000, 4000)), 4000);
assert.deepEqual(rewardFor(stepProofs(4000, 1000)), rewardFor(vq({ unit: "steps", target: 6000, proofs: [{ amount: 4000, verified: true }] })));
assert.deepEqual(rewardFor(stepProofs(3000, 4500)), rewardFor(vq({ target: 6000, proofs: [{ amount: 3000, verified: true }, { amount: 1500, verified: false }] })));

// proof-based quests
const fresh = (className) => { const s = createState({ className }); s.day = "2026-10-20"; s.quests = makeQuests("2026-10-20", className); return s; };
const wb = fresh("warrior");
const wMain = wb.quests.find((q) => q.main);
assert.deepEqual(wMain.verify, ["health-workout", "timer"]);
assert.deepEqual(wb.quests.find((q) => q.unit === "steps").verify, ["health-steps", "manual"]);
assert.equal(wMain.day, "2026-10-20");
assert.deepEqual(wMain.proofs, []);
assert.equal(logProgress(wb, wMain.id, 30, at(12)).changed, false);
assert.equal(wMain.progress, 0);
const march = wb.quests.find((q) => q.unit === "steps");
logProgress(wb, march.id, 6000, at(12));
assert.equal(march.status, "completed");
assert.equal(wb.player.xp, 25);
startSession(wb, wMain.id, at(10));
assert.equal(startSession(wb, march.id, at(10, 1)).changed, false);
pauseSession(wb, at(10, 10));
resumeSession(wb, at(10, 20));
finishSession(wb, at(10, 40));
assert.equal(wMain.status, "completed");
assert.equal(wMain.proofs[0].amount, 30);
assert.equal(wb.player.xp, 125);
assert.equal(wb.player.streak, 1);
assert.equal(wb.activeSession, null);

const short = fresh("mage");
startSession(short, short.quests[0].id, at(9));
assert.equal(finishSession(short, at(9, 0, 50)).changed, false);
assert.equal(short.activeSession, null);

const sb = fresh("warrior");
const sigil = sb.quests.find((q) => q.unit === "sets");
logSet(sb, sigil.id, at(10));
assert.equal(logSet(sb, sigil.id, at(10, 0, 10)).changed, false);
logSet(sb, sigil.id, at(10, 0, 40));
logSet(sb, sigil.id, at(10, 1, 20));
assert.equal(sigil.status, "completed");

const night = fresh("warrior");
const nightMain = night.quests.find((q) => q.main);
startSession(night, nightMain.id, at(23, 25));
resetForNewDay(night, "2026-10-21", new Date(2026, 9, 21, 0, 0).getTime());
assert.equal(night.activeSession, null);
assert.equal(night.player.xp, 100);
assert.equal(night.player.missed, 0);
assert.equal(night.history[0].title, nightMain.title);
assert.equal(night.quests[0].day, "2026-10-21");

const old = fresh("warrior");
for (const q of old.quests) { delete q.proofs; delete q.verify; delete q.day; }
old.quests[1].progress = 2000;
resetForNewDay(old, "2026-10-20");
assert.equal(old.quests[1].proofs[0].source, "manual");
assert.equal(old.quests[1].proofs[0].amount, 2000);
assert.equal(old.quests[1].proofs[0].verified, false);
assert.equal(old.quests[1].progress, 2000);
assert.deepEqual(old.quests[0].verify, ["health-workout", "timer"]);

assert.deepEqual(workoutCategory("running"), { category: "cardio", known: true });
assert.deepEqual(workoutCategory("weightlifting"), { category: "strength", known: true });
assert.deepEqual(workoutCategory("yoga"), { category: "mobility", known: true });
assert.deepEqual(workoutCategory("golf"), { category: "cardio", known: false });

const hcRun = { id: "hc-run", type: "running", startedAt: iso(at(7)), endedAt: iso(at(7, 25)), minutes: 25, app: "com.sec.android.app.shealth", heartRateSamples: 40 };
const reading = { dayStart: iso(at(0)), steps: { total: 8500 }, workouts: [hcRun] };
const rb = fresh("ranger");
assert.equal(applyHealthReading(rb, reading, at(12)).changed, true);
assert.equal(rb.quests.find((q) => q.main).status, "completed");
assert.equal(rb.quests.find((q) => q.unit === "steps").status, "completed");
assert.equal(rb.quests.find((q) => q.kind === "class").progress, 0);
assert.equal(applyHealthReading(rb, reading, at(12, 5)).changed, false);
assert.equal(rb.health.lastSyncAt, at(12, 5));

const lb = fresh("mage");
applyHealthReading(lb, { dayStart: iso(at(0)), steps: { total: 3000 }, workouts: [] }, at(12));
applyHealthReading(lb, { dayStart: iso(at(0)), steps: { total: 1000 }, workouts: [] }, at(13));
assert.equal(lb.quests.find((q) => q.unit === "steps").progress, 3000);

const nb = fresh("ranger");
applyHealthReading(nb, { dayStart: iso(at(0)), steps: { total: 0 }, workouts: [{ ...hcRun, heartRateSamples: 0, minutes: 15, endedAt: iso(at(7, 15)) }] }, at(12));
assert.equal(nb.quests.find((q) => q.main).progress, 0);
const farSight = nb.quests.find((q) => q.kind === "class");
assert.equal(farSight.status, "completed");
assert.equal(farSight.proofs[0].verified, false);
assert.equal(nb.player.xp, 40);

const ob = fresh("ranger");
startSession(ob, ob.quests.find((q) => q.main).id, at(7));
finishSession(ob, at(7, 25));
applyHealthReading(ob, { dayStart: iso(at(0)), steps: { total: 0 }, workouts: [hcRun] }, at(12));
assert.equal(ob.quests.find((q) => q.kind === "class").progress, 0);

// final fix: overlapping health workout leaves a running timer's minutes alone
const tm = fresh("ranger");
startSession(tm, mainOf(tm).id, at(7));
applyHealthReading(tm, { dayStart: iso(at(0)), steps: { total: 0 }, workouts: [hcRun] }, at(7, 30));
assert.equal(tm.quests.find((q) => q.kind === "class").progress, 0);
finishSession(tm, at(7, 35));
assert.equal(mainOf(tm).proofs[0].source, "timer");
assert.equal(mainOf(tm).status, "completed");

// final fix: finishing on an already-complete quest says so
const dn = fresh("ranger");
const dnQ = mainOf(dn);
startSession(dn, dnQ.id, at(9));
applyHealthReading(dn, { dayStart: iso(at(0)), steps: { total: 0 }, workouts: [{ ...hcRun, minutes: 60, endedAt: iso(at(8)) }] }, at(9, 5));
assert.equal(dnQ.status, "completed");
finishSession(dn, at(9, 30));
assert.equal(dn.notice, "Quest already complete; minutes not credited.");

// Task 3b: timer credit is capped
const ovn = fresh("warrior");
const ovMain = mainOf(ovn);
startSession(ovn, ovMain.id, at(23, 25));
const ovMissed = ovn.player.missed;
resetForNewDay(ovn, "2026-10-21", new Date(2026, 9, 21, 8).getTime());
assert.equal(ovMain.proofs[0].amount, 35);
assert.equal(ovMain.proofs[0].endedAt, iso(new Date(2026, 9, 21).getTime()));
assert.equal(ovMain.status, "completed");
assert.equal(ovn.player.missed, ovMissed);

const fg = fresh("warrior");
startSession(fg, mainOf(fg).id, at(10));
finishSession(fg, at(18));
assert.equal(mainOf(fg).proofs[0].amount, 180);

const nrm = fresh("warrior");
startSession(nrm, mainOf(nrm).id, at(10));
finishSession(nrm, at(10, 40));
assert.equal(mainOf(nrm).proofs[0].amount, 40);

console.log("QuestFit game logic checks passed.");
