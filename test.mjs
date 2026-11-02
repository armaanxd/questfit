import assert from "node:assert/strict";
import { createState, fitnessLevelInfo, levelForXp, logProgress, missQuest, rankProgress, resetForNewDay, todayKey, useDayPass, workoutRotationDay } from "./game.js";
import { acceptProof, progressOf, rewardFor } from "./verify.js";

const midnightBoundary = new Date("2026-10-10T00:30:00.000Z");
assert.equal(todayKey(midnightBoundary, "Asia/Kolkata"), "2026-10-10");
assert.equal(todayKey(midnightBoundary, "America/Los_Angeles"), "2026-10-09");
assert.notEqual(workoutRotationDay("2026-10-09"), workoutRotationDay("2026-10-10"));
assert.equal(workoutRotationDay("2026-10-09"), workoutRotationDay("2026-10-16"));
assert.equal(fitnessLevelInfo("beginner").rank, "E");
assert.equal(fitnessLevelInfo("advanced").rank, "A");
assert.equal(fitnessLevelInfo("master").rank, "S");
assert.equal(fitnessLevelInfo("regular").label, "Capable");

const rolloverState = createState({ className: "mage" });
const rolloverQuestId = rolloverState.quests[0].id;
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
logProgress(statState, statState.quests.find((quest) => quest.main).id, 30);
assert.ok(statState.player.stats.strength > startingStrength);

const state = createState({ name: "Test", penaltyMode: "balanced" });
const main = state.quests.find((quest) => quest.main);

logProgress(state, main.id, main.target);
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

const mainOf = (s) => s.quests.find((quest) => quest.main);
const finishMain = (s) => logProgress(s, mainOf(s).id, mainOf(s).target);

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

console.log("QuestFit game logic checks passed.");
