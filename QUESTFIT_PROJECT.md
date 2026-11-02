# QuestFit — Product and Local Prototype Notes

**Status:** Local-first prototype  
**Last updated:** 2026-10-12  
**Prototype location:** `/Users/armaansingh/questfit`

## 1. Product vision

QuestFit turns daily fitness into a persistent RPG campaign. Users complete daily quests, earn XP and coins, grow a character build, and receive controlled virtual consequences when they skip their main quest.

The intended audience is people who enjoy games or RPGs but struggle to stay consistent with ordinary fitness apps.

The design direction is an original dark-fantasy / hunter interface inspired by the feeling of rank progression in Solo Leveling, without copying its characters, assets, or story.

## 2. Core product decisions

- Fitness consistency is the main quest.
- Rewards and opt-in virtual penalties create stakes.
- Penalties never use real money or public shaming.
- Rest and sick days protect users from being punished for recovery.
- Solo play must be useful before social features are added.
- Daily quests reset at local midnight instead of waiting 24 hours.
- Workout suggestions depend on both the user's class and fitness rank.

## 3. Implemented local prototype

### Local login and onboarding

- Separate login page.
- Local-only campaign storage in browser `localStorage`.
- No credentials are sent to a server.
- Any password with at least four characters is accepted by the prototype.
- Onboarding collects:
  - Name
  - Class
  - Fitness level/rank
  - Penalty mode
- Current fitness levels:

| Fitness level | Rank | Workout intent |
|---|---:|---|
| Beginner | E | Low-intensity foundations |
| Capable | D | Controlled basic sessions |
| Intermediate | C | Steady training volume |
| Proficient | B | Demanding structured work |
| Advanced | A | High-intensity structured work |
| Master | S | High-intensity mastery |

The six selectable levels use the full E-to-S ladder: E, D, C, B, A, and S.

Legacy values from earlier onboarding (`regular` and `athlete`) are still mapped to Capable and Proficient.

### Classes and quests

The current classes are:

- **Warrior:** strength-focused quests.
- **Ranger:** cardio, running, and distance quests.
- **Mage:** mobility, control, and recovery-oriented quests.
- **All-Rounder:** combined training with more demanding targets.

Each class receives its own quest blueprint rather than sharing the same quest text.

Every daily board contains:

- One main quest that protects the streak.
- Two side quests.
- One class-specific trial.

Examples include:

- Warrior: `Break the Iron Gate`, `Forge a Training Sigil`
- Ranger: `Run the Windline`, `Unlock Far-Sight`
- Mage: `Channel the Leyline`, `Cast Arcane Flow`
- All-Rounder: `Conquer the Champion Circuit`, `Master the Fourfold Path`

### Progression and stats

- XP, levels, coins, streaks, longest streak, completed quests, and missed quests.
- Rank progression uses six automatic stages: E, D, C, B, A, and S.
- Base cumulative rank thresholds are 0, 8,000, 18,000, 32,000, 50,000, and 75,000 XP.
- Rank thresholds scale by class difficulty: Mage 1.00x, Ranger 1.05x, Warrior 1.10x, and All-Rounder 1.25x.
- Penalty mode adds a small rank-threshold modifier: Soft 1.00x, Balanced 1.05x, and Hardcore 1.10x; missed-quest XP debuffs still apply separately.
- Quest progress updates immediately when progress is logged.
- Quest completion awards XP and coins.
- Completing all daily main/side quests grants a combo bonus.
- A radar stat sheet tracks Strength, Cardio, Mobility, Endurance, Discipline, Recovery, Agility, and Versatility.
- Stats update from quest progress instead of showing a completed stat sheet at account creation.
- The stat sheet has its own Stats page and is also shown in the main interface.

### Penalties and safety

Penalty modes:

| Mode | Main consequence | XP effect | Avatar state |
|---|---|---:|---|
| Soft | Streak pauses | 0% | Normal |
| Balanced | Streak resets | -25% | Tired |
| Hardcore | Streak resets and coin loss | -50% | Injured |

Additional rules implemented:

- A shield can absorb a streak loss.
- Shield use is capped at four uses per month.
- The prototype starts with one shield in the inventory.
- Rest days and sick days can each be used twice per month.
- Monthly counters reset with the new calendar month.
- Rest and sick days protect the streak without requiring a reason.

Safety rules discussed for a later production version but not fully implemented yet include automatic soft-mode fallback after extended absence, hard-session recovery logic, stronger Hardcore confirmation, and a cumulative debuff cap.

### Daily reset

- Quest IDs include the calendar date.
- The app calculates the day using the device timezone.
- Loading the app resets the board when the local day changes.
- A browser timer schedules a rollover around the next local midnight while the app is open.
- Main, side, and class quests are regenerated for the new day.
- Avatar penalty state and temporary XP debuffs clear at the new day.

### Separate app pages

The app shell now has separate views for:

1. Dashboard / Today
2. Workouts
3. Quests
4. Stats
5. Character

The Character page is separate from the Today dashboard. The dashboard still provides a compact character and assistant summary for quick context.

### Personal assistant avatar

- The 3D avatar is a personal assistant, not the user's player avatar.
- It is a rigged glTF model (`public/models/assistant.glb`, CC0 RobotExpressive) rendered with Three.js, bundled from npm so it works offline in the mobile app.
- It is loaded lazily after the dashboard paints; the 2D CSS slime shows until the model is ready and stays if WebGL or the model fails.
- It waves once per session, then plays an idle loop; a class-colored rim light and glowing ring keep each class distinct.
- Tired plays a slower idle with a slight tilt; injured plays the sitting clip. Reduced-motion users see a still frame.
- To swap the model, replace the .glb and edit the clip names at the top of `avatar3d.js`.

The user character remains a separate character/loadout concept.

### Workout suggestions

The Workouts page contains a library of workout suggestions with:

- Remote workout image.
- Workout category.
- Duration.
- Difficulty/intensity.
- Exercise summary.
- YouTube video-guide search link.
- `Use routine` action that points the user back toward logging matching quest progress.

Recommendations are selected by:

1. Class priority: Warrior, Ranger, Mage, or All-Rounder.
2. Fitness rank cap: workouts above the user's rank are not recommended or shown as unlocked exploration.
3. Calendar rotation: the pool changes by day and repeats on a seven-day cycle.

The current media is remote, so the browser needs internet access to load images and open video guides.

## 4. Actual implementation structure

| File | Responsibility |
|---|---|
| `index.html` | App shell, responsive metadata, cache-busted CSS/module loading |
| `app.js` | Rendering, onboarding, navigation, local persistence, workout cards, reminders, rollover timer |
| `game.js` | Quest blueprints, state creation, quest progression, stats, XP, penalties, shields, rank helpers |
| `styles.css` | Dark-fantasy visual system, responsive layout, pages, stat sheet, workout cards |
| `avatar3d.js` | Loads and animates the glTF personal assistant (Three.js) |
| `notification-worker.js` | Prototype scheduled browser notification handler |
| `test.mjs` | Assert-based game logic checks |
| `README.md` | Short local run guide |

## 5. Local state model

The prototype stores one campaign under:

- `questfit-local-v1`: campaign state.
- `questfit-session-v1`: local session marker.

The state includes:

- Profile and timezone.
- Class, fitness level, and penalty mode.
- Daily quests and quest version.
- XP, coins, streaks, shields, and monthly counters.
- Avatar state and temporary XP debuff.
- Stats and stat version.
- Quest history and notices.

There is no backend database in the current app.

## 6. Database/schema planning

The product concept originally included a PostgreSQL schema with users, quest templates, quest instances, parties, XP/coin ledger entries, penalties, and health-sync data.

Important planned schema decisions were:

- Append-only XP/coin ledger for auditability.
- Idempotent penalty events so retries cannot penalize twice.
- Per-user timezone handling.
- Quest-instance target values so difficulty scaling does not rewrite templates.
- Redis for fast leaderboard and party-related data later.

Those database ideas are planning material only. The current prototype does not connect to PostgreSQL, Redis, Supabase, HealthKit, Google Fit, payments, or a backend API.

## 7. Proposed production stack

The original product plan considered:

- Flutter or React Native for mobile.
- NestJS or FastAPI for the backend.
- PostgreSQL and Redis.
- Firebase or Supabase Auth.
- Apple HealthKit and Google Health Connect.
- FCM and APNs notifications.
- Socket.io or Supabase Realtime for parties.
- S3 or Cloudflare R2 for assets.
- PostHog or Mixpanel for analytics.
- RevenueCat for subscriptions.

None of these production services are wired into the local prototype yet.

## 8. Validation and checks

The current logic checks pass with:

```bash
cd /Users/armaansingh/questfit
node --check app.js
node --check game.js
node test.mjs
```

The tests cover:

- Timezone day boundaries.
- Daily quest rollover.
- Class-specific quest differences.
- All-Rounder quest count and difficulty target.
- Stat growth from quest progress.
- Completion rewards and streaks.
- Shield use and penalty behavior.
- Rest-day protection.
- XP level calculation.
- Daily workout rotation and seven-day repeat.
- Fitness-rank aliases.

## 9. Running the prototype

```bash
cd /Users/armaansingh/questfit
python3 -m http.server 4173
```

Open <http://localhost:4173> in a browser.

The prototype is local-first and does not need an account, API key, database, or payment setup.

## 10. Remaining work

### Highest priority

- Move the rank selector into Character or Settings so users can update it after onboarding.
- Decide whether rank should be manually selected, automatically promoted, or both.
- Improve the workout catalog with reviewed, stable video URLs instead of search links.
- Add offline/local fallback images so workout cards do not break without internet.
- Verify the complete mobile layout on actual phone-sized screens.

### Production work

- Replace local login with real authentication.
- Add backend persistence and multi-device sync.
- Integrate HealthKit and Health Connect.
- Add anti-cheat and health-data validation.
- Add content management for quest/story/workout updates.
- Add parties, friends, guilds, and social permissions.
- Add analytics and retention experiments.
- Add subscription and cosmetic monetization.
- Add privacy policy, health-data consent, accessibility review, and app-store compliance.

### Content and game design

- Write the first four story chapters.
- Add more class-specific trials.
- Create level-appropriate variants of each workout rather than only filtering by difficulty.
- Add recovery-aware adaptive difficulty.
- Define rank promotion requirements and seasonal progression.
- Decide whether Hardcore should unlock only after a user has demonstrated safe consistency.

