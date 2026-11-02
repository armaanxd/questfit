import { Health } from "@capgo/capacitor-health";

export async function isAvailable() {
  try {
    return (await Health.isAvailable()).available;
  } catch {
    return false;
  }
}

const READ = { read: ["steps", "workouts", "heartRate"] };
const usable = ({ readAuthorized }) => readAuthorized.includes("steps") || readAuthorized.includes("workouts");

export async function connect() {
  try {
    return usable(await Health.requestAuthorization(READ));
  } catch {
    return false;
  }
}

// Checks without prompting, so a permission revoked in Health Connect settings is noticed.
export async function isConnected() {
  try {
    return usable(await Health.checkAuthorization(READ));
  } catch {
    return false;
  }
}

export async function readToday(dayStart, now) {
  const startDate = dayStart.toISOString();
  const endDate = now.toISOString();
  const agg = await Health.queryAggregated({ dataType: "steps", startDate, endDate, bucket: "day", aggregation: "sum" }).catch(() => ({ samples: [] }));
  const total = agg.samples.reduce((sum, s) => sum + s.value, 0);
  const { workouts } = await Health.queryWorkouts({ startDate, endDate, ascending: true }).catch(() => ({ workouts: [] }));
  const mapped = await Promise.all(
    workouts.map(async (w) => ({
      id: w.platformId,
      type: w.workoutType,
      startedAt: w.startDate,
      endedAt: w.endDate,
      minutes: Math.floor(w.duration / 60),
      app: w.sourceId,
      heartRateSamples: (await Health.readSamples({ dataType: "heartRate", startDate: w.startDate, endDate: w.endDate }).catch(() => ({ samples: [] }))).samples.length,
    })),
  );
  return { dayStart: startDate, steps: { total }, workouts: mapped };
}

export const showPrivacyPolicy = () => Health.showPrivacyPolicy();
// Plugin names this openHealthConnectSettings.
export const openSettings = () => Health.openHealthConnectSettings();
