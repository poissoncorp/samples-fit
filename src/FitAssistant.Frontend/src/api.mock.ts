// In-browser mock for development without Aspire running. Toggle via
// `?mock=1` URL param or `localStorage.setItem('fit-assistant-mock', '1')`.
// Shape contract is enforced at the bottom of this file via an `Api`
// assignment — drift between real and mock is a compile error.

import type {
  Achievements,
  Api,
  CalorieIntakeResponse,
  CaloriesSeries,
  DailyGoalsResponse,
  Exercise,
  ExerciseResponse,
  ExercisesResponse,
  FeedItem,
  FeedResponse,
  FollowsResponse,
  FriendsResponse,
  GoalToggleResponse,
  HeartRatePoint,
  LiveWorkoutsResponse,
  PeerStandingResponse,
  PipelineStats,
  SeedResponse,
  SimulateMessageResponse,
  TrendsResponse,
  UserSummary,
  WearableSyncResponse,
} from './apiTypes';

const MOCK_USERS: UserSummary[] = [
  { id: 'UserProfiles/1-A', name: 'Taylor Active', fitnessGoal: 'Build muscle',            isPremium: true  },
  { id: 'UserProfiles/2-A', name: 'Morgan Fit',    fitnessGoal: 'Lose weight',              isPremium: false },
  { id: 'UserProfiles/3-A', name: 'Riley Strong',  fitnessGoal: 'Improve cardio endurance', isPremium: true  },
];

const MOCK_FITNESS_GOALS = [
  'Lose weight',
  'Build muscle',
  'Improve cardio endurance',
  'Maintain fitness',
  'Train for marathon',
  'General health',
];

// `?empty=1` boots the mock with zero users to exercise the welcome flow.
const startEmpty =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('empty') === '1';

let mockUsersStore: UserSummary[] = startEmpty ? [] : [...MOCK_USERS];

function delay<T>(value: T, ms = 220): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function buildHeartRateSeries(rangeHours: number): HeartRatePoint[] {
  const now = Date.now();
  const points = Math.min(rangeHours * 6, 240);
  const out: HeartRatePoint[] = [];
  for (let i = points - 1; i >= 0; i--) {
    const t = now - i * (rangeHours * 3600 * 1000) / points;
    const base = 65 + Math.sin(i / 6) * 6;
    const spike = i % 30 < 5 ? rand(20, 45) : rand(-3, 3);
    out.push({ timestamp: new Date(t).toISOString(), bpm: Math.round(base + spike) });
  }
  return out;
}

function buildCaloriesSeries(days: number): CaloriesSeries {
  const now = new Date();
  const intake: { date: string; total: number }[] = [];
  const burned: { date: string; total: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString();
    intake.push({ date: iso, total: Math.round(1700 + rand(-300, 600)) });
    burned.push({ date: iso, total: Math.round(380 + rand(-120, 320)) });
  }
  return { intake, burned };
}

const EXERCISES: Omit<Exercise, 'id' | 'startTime' | 'endTime'>[] = [
  { type: 'Running',           durationMinutes: 35, caloriesBurned: 312 },
  { type: 'Cycling',           durationMinutes: 45, caloriesBurned: 380 },
  { type: 'HIIT',              durationMinutes: 25, caloriesBurned: 290 },
  { type: 'Strength Training', durationMinutes: 50, caloriesBurned: 280 },
  { type: 'Yoga',              durationMinutes: 30, caloriesBurned: 90  },
];

function buildExercises(rangeDays: number): ExercisesResponse {
  const exercises: Exercise[] = [];
  const count = Math.min(rangeDays, 8);
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const ex = EXERCISES[i % EXERCISES.length];
    const d = new Date(now);
    d.setDate(d.getDate() - Math.floor(i * (rangeDays / Math.max(1, count))));
    d.setHours(7 + Math.floor(rand(0, 12)));
    const start = new Date(d);
    const end = new Date(d.getTime() + ex.durationMinutes * 60_000);
    exercises.push({
      id: `${i + 1}-A`,
      ...ex,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    });
  }
  return { exercises, userGoal: 'Build muscle' };
}

// ---- Mocked API surface ---------------------------------------------------

export const getUsers = () => delay<UserSummary[]>([...mockUsersStore]);

export const getUser = (id: string) =>
  delay<any>({
    id,
    name: mockUsersStore.find((u) => u.id === id)?.name ?? 'Unknown',
    birthday: '1997-04-12',
    weightKg: 72,
    heightCm: 178,
    dailyCalorieGoal: 2200,
    fitnessGoal: mockUsersStore.find((u) => u.id === id)?.fitnessGoal ?? 'General health',
  });

export const getFitnessGoals = () => delay([...MOCK_FITNESS_GOALS]);

export const generateUser = (fitnessGoal: string, isPremium: boolean = false): Promise<UserSummary> => {
  const id = `UserProfiles/${mockUsersStore.length + 1}-A`;
  const names = ['Avery', 'Quinn', 'Dakota', 'Reese', 'Skyler'];
  const surnames = ['Bold', 'Steady', 'Swift'];
  const name = `${names[Math.floor(Math.random() * names.length)]} ${
    surnames[Math.floor(Math.random() * surnames.length)]
  }`;
  const user: UserSummary = { id, name, fitnessGoal, isPremium };
  mockUsersStore.push(user);
  return delay(user);
};

export const getHeartRate = (_userId: string, range = '24h'): Promise<HeartRatePoint[]> => {
  const hours =
    range === '1h' ? 1 :
    range === '6h' ? 6 :
    range === '24h' ? 24 :
    range === '7d' ? 168 : 720;
  return delay(buildHeartRateSeries(hours));
};

export const getCalories = (_userId: string, range = '7d'): Promise<CaloriesSeries> => {
  const days = range === '24h' ? 1 : range === '7d' ? 7 : 30;
  return delay(buildCaloriesSeries(days));
};

export const getExercises = (_userId: string, range = '7d'): Promise<ExercisesResponse> => {
  const days = range === '24h' ? 1 : range === '7d' ? 7 : 30;
  return delay(buildExercises(days));
};

export const getDailyGoals = (_userId: string): Promise<DailyGoalsResponse> =>
  delay({
    ready: true,
    id: 'DailyGoals/mock/2026-05-13',
    forDate: '2026-05-13',
    motivation: "Yesterday you locked in cardio but skipped nutrition — let's land both today.",
    goals: [
      {
        text: 'Burn 300 kcal today — preferably with a 30-min zone-2 run.',
        fulfilled: true,
        predicate: { type: 'BURN', amount: 300 },
      },
      {
        text: 'Hit 2,200 kcal intake — lean protein-forward.',
        fulfilled: false,
        predicate: { type: 'INTAKE', amount: 2200 },
      },
      {
        text: 'Add a 10-minute mobility block tonight: hips and shoulders.',
        fulfilled: false,
        predicate: null,
      },
    ],
    generatedAt: new Date(Date.now() - 4 * 60_000).toISOString(),
    cadenceSeconds: 86400,
  });

export const toggleGoalFulfillment = (
  _userId: string,
  index: number,
  fulfilled: boolean,
): Promise<GoalToggleResponse> =>
  delay({ index, fulfilled });

export const simulateWearableSync = (_userId: string): Promise<WearableSyncResponse> =>
  delay({ message: 'Wearable sync complete. Added 7 heart rate data points.', pointsAdded: 7 });

export const simulateCalorieIntake = (
  _userId: string,
  _level: number,
  _date?: string,
): Promise<CalorieIntakeResponse> =>
  delay({
    message: 'Logged: Grilled chicken salad (480 cal)',
    description: 'Grilled chicken salad',
    calories: 480,
  });

export const simulateExercise = (_userId: string, _date?: string): Promise<ExerciseResponse> =>
  delay({ message: 'Running — 35min, 312 cal burned', durationMinutes: 35, caloriesBurned: 312 });

export const simulateActiveExercise = (_userId: string): Promise<SimulateMessageResponse> =>
  delay({ message: 'Started a cycling session' });

export const extendActiveExercise = (_id: string, minutes = 20): Promise<SimulateMessageResponse> =>
  delay({ message: `+${minutes}m elapsed — total ${30 + minutes}m so far.` });

export const finishActiveExercise = (_id: string): Promise<SimulateMessageResponse> =>
  delay({ message: 'Finished — 35 min, 280 cal logged.' });

export async function streamChat(
  message: string,
  _userId: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  photo?: File | null,
  _intent?: string,
) {
  const intro = photo
    ? `Looked at your photo (${photo.name}). Logged: Grilled chicken salad with vinaigrette (450 cal).`
    : `Got it. Looking at your last 7 days, your cardio looks solid. Here's one thought on "${message.slice(0, 40)}":`;
  const reply = photo
    ? `${intro} Want to log a workout next?`
    : `${intro} try adding a 20-minute mobility block on rest days to help recovery without piling on volume.`;
  for (const word of reply.split(' ')) {
    await new Promise((r) => setTimeout(r, 40));
    onChunk(word + ' ');
  }
  onDone();
}

export const seedAll = (): Promise<SeedResponse> => {
  mockUsersStore = [...MOCK_USERS];
  return delay({ message: 'Seed data created successfully.' });
};

export const getPeerStanding = (
  _userId: string,
  period: 'week' | 'month' | 'year' = 'week',
): Promise<PeerStandingResponse> =>
  delay({
    period,
    days: period === 'week' ? 7 : period === 'month' ? 30 : 365,
    you: {
      kcalPercentile: 72,
      sessionsPercentile: 65,
      totalMembers: 4,
      kcalPerSessionDeltaPct: 12.5,
    },
  });

// Live workouts mock — fixed snapshot. SSE not emulated; LiveWorkouts.tsx
// falls back to polling when the EventSource fails to open (mock mode
// never opens one — data: URI from liveWorkoutsStreamUrl).
const mockLive: LiveWorkoutsResponse['items'] = [
  {
    session: {
      id: 'ExerciseSessions/seed-live-1',
      userProfileId: 'UserProfiles/2-A',
      type: 'Running',
      startTime: new Date(Date.now() - 4 * 60_000).toISOString(),
      endTime: null,
      caloriesBurned: 28,
    },
    userName: 'Morgan Fit',
  },
];

export const getLiveWorkouts = (): Promise<LiveWorkoutsResponse> => delay({ items: [...mockLive] });
export const liveWorkoutsStreamUrl = (): string => 'data:text/event-stream,';

// ---- Track C mocks (friends, feed, achievements, trends) -------------------

let mockFollows = new Set<string>(['UserProfiles/2-A', 'UserProfiles/4-A']);
const mockFollowProfiles: Record<string, { name: string; isPremium: boolean; goal: string }> = {
  'UserProfiles/1-A': { name: 'Alex Runner',    isPremium: true,  goal: 'Improve cardio endurance' },
  'UserProfiles/2-A': { name: 'Sam Lifter',     isPremium: false, goal: 'Build muscle' },
  'UserProfiles/3-A': { name: 'Jordan Starter', isPremium: false, goal: 'Lose weight' },
  'UserProfiles/4-A': { name: 'Casey Balance',  isPremium: true,  goal: 'General health' },
};

export const getFriends = (userId: string): Promise<FriendsResponse> =>
  delay({
    userId,
    friends: Array.from(mockFollows)
      .filter((id) => id !== userId && mockFollowProfiles[id])
      .map((id) => ({ id, ...mockFollowProfiles[id]! })),
  });

export const followUser = (userId: string, otherUserId: string): Promise<FollowsResponse> => {
  mockFollows.add(otherUserId);
  return delay({ userId, follows: Array.from(mockFollows) });
};

export const unfollowUser = (userId: string, otherUserId: string): Promise<FollowsResponse> => {
  mockFollows.delete(otherUserId);
  return delay({ userId, follows: Array.from(mockFollows) });
};

export const getFeed = (userId: string, _limit = 50): Promise<FeedResponse> =>
  delay({
    userId,
    items: [
      {
        id: 'workout/mock-1', kind: 'workout', viewerUserId: userId,
        actorUserId: 'UserProfiles/2-A', exerciseType: 'Strength Training',
        durationMinutes: 55, caloriesBurned: 310,
        createdAt: new Date(Date.now() - 12 * 60_000).toISOString(),
      },
      {
        id: 'ach/mock-1', kind: 'achievement', viewerUserId: userId,
        title: '3-day streak', detail: "You've trained 3 days in a row.", icon: '🔥',
        createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
      },
      {
        id: 'workout/mock-2', kind: 'workout', viewerUserId: userId,
        actorUserId: 'UserProfiles/4-A', exerciseType: 'Cycling',
        durationMinutes: 42, caloriesBurned: 380,
        createdAt: new Date(Date.now() - 4 * 3600_000).toISOString(),
      },
    ],
  });

export const getAchievements = (userId: string): Promise<Achievements> =>
  delay({
    userId,
    currentStreakDays: 3,
    longestStreakDays: 8,
    level: 2,
    lifetimeWorkouts: 14,
    lifetimeKcalBurned: 7250,
  });

// Mock SSE — fires a synthetic feed item every 25s so the UI exercises its
// onItem handler. The real impl uses EventSource against FitFeed.
export function streamFeed(
  userId: string,
  onItem: (item: FeedItem) => void,
): () => void {
  const handle = window.setInterval(() => {
    onItem({
      id: `workout/mock-live-${Date.now()}`,
      kind: 'workout',
      viewerUserId: userId,
      actorUserId: 'UserProfiles/2-A',
      exerciseType: 'Running',
      durationMinutes: 30,
      caloriesBurned: 280,
      createdAt: new Date().toISOString(),
    });
  }, 25_000);
  return () => window.clearInterval(handle);
}

// Mock pipeline stats — picks a plausible publish/consume balance and slowly
// climbs across polls so the HUD looks live even in mock mode.
let _mockPipelineTick = 0;
const _mockActors = ['Alex Runner', 'Sam Lifter', 'Casey Balance', 'Jordan Starter'];
const _mockTypes  = ['Running', 'Cycling', 'HIIT', 'Strength Training'];
export const getPipelineStats = (): Promise<PipelineStats> => {
  _mockPipelineTick += 1;
  const published  = 40 + _mockPipelineTick;
  const consumed   = Math.max(0, published - (Math.random() < 0.3 ? 2 : 0));
  const kinds = ['feed.deliver', 'feed.deliver', 'achievement.unlock', 'olap.write', 'goal.progress', 'feed.deliver'];
  const recent = Array.from({ length: 8 }).map((_, i) => {
    const a = _mockActors[i % _mockActors.length];
    const t = _mockTypes[i % _mockTypes.length];
    const d = 20 + (i * 5) % 40;
    const c = 220 + (i * 37) % 200;
    const kind = kinds[i % kinds.length];
    let summary: string;
    if      (kind === 'feed.deliver')       summary = `${a} -> 2-A | ${t} ${d}m / ${c} cal`;
    else if (kind === 'achievement.unlock') summary = `${a}: 3-day streak -- You've trained 3 days in a row.`;
    else if (kind === 'olap.write')         summary = `trends-olap-etl flushed +${3 + (i % 4)} row(s) (total ${30 + _mockPipelineTick})`;
    else                                    summary = `${a} hit ${1 + (i % 3)}/3 goals (fanned to 2 friend(s))`;
    return {
      at: new Date(Date.now() - i * 12_000).toISOString(),
      kind,
      summary,
    };
  });
  return delay({
    queueEtl: { task: 'activity-feed-etl', published, transforms: published - 1, errors: 0, consumed },
    olapEtl:  { task: 'trends-olap-etl',   writes:   30 + _mockPipelineTick, errors: 0 },
    minio:    { bucket: 'fit-trends',      parquetFiles: 7, totalBytes: 18432 },
    duckdb:   { ready: true,               rowCount: 28 + _mockPipelineTick, queryCount: _mockPipelineTick },
    recent,
    generatedAt: new Date().toISOString(),
  });
};

export const runOlapEtl = () =>
  delay({ message: 'OLAP ETL retriggered — pending writes flushing, processing resumed.' });

export const getTrends = (period: 'week' | 'month' | 'year', userId?: string): Promise<TrendsResponse> =>
  delay({
    period,
    days: period === 'week' ? 7 : period === 'month' ? 30 : 365,
    you: userId ? {
      kcalPercentile: 72,
      sessionsPercentile: 58,
      totalMembers: 4,
      kcalPerSessionDeltaPct: 5.1,
    } : null,
    trendingTypes: [
      { exerciseType: 'Running',           sessionCount: 18, totalCaloriesBurned: 6240, avgKcalPerSession: 347, avgDurationMinutes: 38 },
      { exerciseType: 'Cycling',           sessionCount: 12, totalCaloriesBurned: 5180, avgKcalPerSession: 432, avgDurationMinutes: 47 },
      { exerciseType: 'Strength Training', sessionCount:  9, totalCaloriesBurned: 2640, avgKcalPerSession: 293, avgDurationMinutes: 52 },
      { exerciseType: 'HIIT',              sessionCount:  6, totalCaloriesBurned: 1820, avgKcalPerSession: 303, avgDurationMinutes: 24 },
    ],
    dailyVolume: Array.from({ length: 7 }).map((_, i) => ({
      day: new Date(Date.now() - (6 - i) * 86_400_000).toISOString().slice(0, 10),
      sessions: 3 + Math.floor(Math.random() * 4),
      totalKcal: 1200 + Math.floor(Math.random() * 800),
    })),
    userVsPlatform: userId ? [
      { exerciseType: 'Running', yourSessions: 4, yourAvgKcal: 320, platformAvgKcal: 290, yourAvgMinutes: 35, platformAvgMinutes: 38 },
      { exerciseType: 'Cycling', yourSessions: 2, yourAvgKcal: 410, platformAvgKcal: 430, yourAvgMinutes: 48, platformAvgMinutes: 47 },
    ] : null,
  });

// Contract enforcement — drift between this mock and the shared Api surface
// is a compile error on this assignment.
const _apiContractCheck: Api = {
  getUsers, getUser, getFitnessGoals, generateUser,
  getHeartRate, getCalories, getExercises,
  getDailyGoals, toggleGoalFulfillment,
  simulateWearableSync, simulateCalorieIntake, simulateExercise,
  simulateActiveExercise, extendActiveExercise, finishActiveExercise,
  streamChat, seedAll,
  getPeerStanding, getLiveWorkouts, liveWorkoutsStreamUrl,
  getFriends, followUser, unfollowUser,
  getFeed, getAchievements, streamFeed,
  getTrends, getPipelineStats, runOlapEtl,
};
void _apiContractCheck;
