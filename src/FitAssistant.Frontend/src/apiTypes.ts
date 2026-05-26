// Single source of truth for response shapes shared between `api.real.ts`
// and `api.mock.ts`. Anything the backend returns and the frontend renders
// goes here — the impl files import these and the compiler enforces the
// contract on both sides.

export type UserSummary = {
  id: string;
  name: string;
  fitnessGoal: string;
  isPremium: boolean;
};

export type HeartRatePoint = { timestamp: string; bpm: number };

export type CaloriesSeries = {
  intake: { date: string; total: number }[];
  burned: { date: string; total: number }[];
};

export type Exercise = {
  id?: string;
  type: string;
  startTime: string;
  /** Null while the workout is in progress (the live-workout lifecycle marker). */
  endTime: string | null;
  durationMinutes: number;
  caloriesBurned: number;
  /** Set once by the auto-coach GenAI Task for Ultra users; null for Free. */
  coachNote?: string | null;
};

export type ExercisesResponse = { exercises: Exercise[]; userGoal: string };

export type GoalPredicate = {
  /** BURN — fulfilled by cumulative kcal burned today reaching `amount`.
   *  INTAKE — fulfilled by cumulative kcal intake today reaching `amount`. */
  type: 'BURN' | 'INTAKE';
  amount: number;
};

export type DailyGoalItem = {
  text: string;
  fulfilled: boolean;
  /** null = manual goal (UI-toggled only); otherwise the auto-fulfill threshold. */
  predicate: GoalPredicate | null;
};

export type DailyGoalsResponse = {
  ready: boolean;
  id?: string;
  forDate: string;
  /** One-sentence contextual motivator generated alongside the goals,
   *  shown above the list. References yesterday's results when available. */
  motivation?: string | null;
  goals?: DailyGoalItem[];
  generatedAt?: string;
  cadenceSeconds: number;
};

export type GoalToggleResponse = {
  index: number;
  fulfilled: boolean;
};

export type WearableSyncResponse = { message: string; pointsAdded: number };

export type CalorieIntakeResponse = {
  message: string;
  description: string;
  calories: number;
};

export type ExerciseResponse = {
  message: string;
  durationMinutes: number;
  caloriesBurned: number;
};

export type SimulateMessageResponse = { message: string };

export type PeerStandingResponse = {
  period: string;
  days: number;
  you: {
    kcalPercentile: number;
    sessionsPercentile: number;
    totalMembers: number;
    kcalPerSessionDeltaPct: number | null;
  } | null;
};

export type LiveWorkout = {
  session: {
    id: string;
    userProfileId: string;
    type: string;
    startTime: string;
    /** Live → null, completed → set. Duration is (endTime − startTime); the
     *  doc doesn't carry a separate minutes field. */
    endTime: string | null;
    caloriesBurned: number;
  };
  userName: string;
};

export type LiveWorkoutsResponse = { items: LiveWorkout[] };

export type FriendSummary = {
  id: string;
  name: string;
  isPremium: boolean;
  goal: string;
};

export type FriendsResponse = { userId: string; friends: FriendSummary[] };
export type FollowsResponse = { userId: string; follows: string[] };

export type FeedItem = {
  id: string;
  kind: 'workout' | 'achievement' | 'goal';
  viewerUserId: string;
  createdAt: string;
  actorUserId?: string;
  exerciseType?: string;
  durationMinutes?: number;
  caloriesBurned?: number;
  title?: string;
  detail?: string;
  icon?: string;
};

export type FeedResponse = { userId: string; items: FeedItem[] };

export type Achievements = {
  userId: string;
  currentStreakDays: number;
  longestStreakDays: number;
  level: number;
  lifetimeWorkouts: number;
  lifetimeKcalBurned: number;
};

export type TrendingType = {
  exerciseType: string;
  sessionCount: number;
  totalCaloriesBurned: number;
  avgKcalPerSession: number;
  avgDurationMinutes: number;
};

export type DailyVolumePoint = {
  day: string;
  sessions: number;
  totalKcal: number;
};

export type UserVsPlatformRow = {
  exerciseType: string;
  yourSessions: number;
  yourAvgKcal: number;
  platformAvgKcal: number;
  yourAvgMinutes: number;
  platformAvgMinutes: number;
};

/** Cross-user comparative rollup for the Trends tab's "Your standing"
 *  headline — only data that genuinely justifies the OLAP path. Null when
 *  no userId was supplied. */
export type YourPeerStanding = {
  kcalPercentile: number;
  sessionsPercentile: number;
  totalMembers: number;
  kcalPerSessionDeltaPct: number | null;
};

export type TrendsResponse = {
  period: string;
  days: number;
  you: YourPeerStanding | null;
  trendingTypes: TrendingType[];
  dailyVolume: DailyVolumePoint[];
  userVsPlatform: UserVsPlatformRow[] | null;
};

export type PipelineEvent = {
  at: string;
  kind: 'feed.deliver' | 'achievement.unlock' | 'olap.write' | 'goal.progress' | 'attachment.minio-drain' | string;
  summary: string;
};

export type PipelineStats = {
  queueEtl: {
    task: string;
    published: number;
    transforms: number;
    errors: number;
    consumed: number;
  };
  olapEtl: {
    task: string;
    writes: number;
    errors: number;
  };
  minio: {
    bucket: string;
    parquetFiles: number;
    totalBytes: number;
  };
  duckdb: {
    ready: boolean;
    rowCount: number;
    queryCount: number;
  };
  recent: PipelineEvent[];
  generatedAt: string;
};

export type SeedResponse = { message: string };

/** Shape every implementation of the API surface must satisfy. Both
 *  `api.real.ts` and `api.mock.ts` declare their exports as members of this
 *  contract — drift between them is a compile error. */
export interface Api {
  // Users
  getUsers(): Promise<UserSummary[]>;
  getUser(id: string): Promise<any>;
  getFitnessGoals(): Promise<string[]>;
  generateUser(fitnessGoal: string, isPremium?: boolean): Promise<UserSummary>;

  // Health data
  getHeartRate(userId: string, range?: string): Promise<HeartRatePoint[]>;
  getCalories(userId: string, range?: string): Promise<CaloriesSeries>;
  getExercises(userId: string, range?: string): Promise<ExercisesResponse>;

  // Daily goals
  getDailyGoals(userId: string): Promise<DailyGoalsResponse>;
  toggleGoalFulfillment(userId: string, index: number, fulfilled: boolean): Promise<GoalToggleResponse>;

  // Simulate
  simulateWearableSync(userId: string): Promise<WearableSyncResponse>;
  simulateCalorieIntake(userId: string, level: number, date?: string): Promise<CalorieIntakeResponse>;
  simulateExercise(userId: string, date?: string): Promise<ExerciseResponse>;
  simulateActiveExercise(userId: string): Promise<SimulateMessageResponse>;
  extendActiveExercise(exerciseId: string, minutes?: number): Promise<SimulateMessageResponse>;
  finishActiveExercise(exerciseId: string): Promise<SimulateMessageResponse>;

  // Chat (SSE — hand-rolled; not a JSON response)
  streamChat(
    message: string,
    userId: string,
    onChunk: (text: string) => void,
    onDone: () => void,
    photo?: File | null,
  ): Promise<void>;

  // Seed
  seedAll(): Promise<SeedResponse>;

  // Stats + Live
  getPeerStanding(userId: string, period?: 'week' | 'month' | 'year'): Promise<PeerStandingResponse>;
  getLiveWorkouts(): Promise<LiveWorkoutsResponse>;
  liveWorkoutsStreamUrl(): string;

  // Friends
  getFriends(userId: string): Promise<FriendsResponse>;
  followUser(userId: string, otherUserId: string): Promise<FollowsResponse>;
  unfollowUser(userId: string, otherUserId: string): Promise<FollowsResponse>;

  // Feed (FitFeed worker — SSE)
  getFeed(userId: string, limit?: number): Promise<FeedResponse>;
  getAchievements(userId: string): Promise<Achievements>;
  streamFeed(
    userId: string,
    onItem: (item: FeedItem) => void,
    onError?: (err: Event) => void,
  ): () => void;

  // Trends + admin
  getTrends(period: 'week' | 'month' | 'year', userId?: string): Promise<TrendsResponse>;
  getPipelineStats(): Promise<PipelineStats>;
  runOlapEtl(): Promise<{ message: string }>;
}
