import type {
  Achievements,
  Api,
  CalorieIntakeResponse,
  CaloriesSeries,
  DailyGoalsResponse,
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

const BASE_URL = process.env.REACT_APP_BACKEND_URL || '';
const FITFEED_URL = process.env.REACT_APP_FITFEED_URL || '';

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, options);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const getUsers = () => fetchJson<UserSummary[]>('/api/users');
export const getUser = (id: string) => fetchJson<any>(`/api/users/${encodeURIComponent(id)}`);
export const getFitnessGoals = () => fetchJson<string[]>('/api/users/fitness-goals');
export const generateUser = (fitnessGoal: string, isPremium: boolean = false) =>
  fetchJson<UserSummary>('/api/users/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fitnessGoal, isPremium }),
  });

export const getHeartRate = (userId: string, range = '24h') =>
  fetchJson<HeartRatePoint[]>(`/api/health/${encodeURIComponent(userId)}/heartrate?range=${range}`);

export const getCalories = (userId: string, range = '7d') =>
  fetchJson<CaloriesSeries>(`/api/health/${encodeURIComponent(userId)}/calories?range=${range}`);

export const getExercises = (userId: string, range = '7d') =>
  fetchJson<ExercisesResponse>(`/api/health/${encodeURIComponent(userId)}/exercises?range=${range}`);

export const getDailyGoals = (userId: string) =>
  fetchJson<DailyGoalsResponse>(`/api/goals/${encodeURIComponent(userId)}`);

export const toggleGoalFulfillment = (userId: string, index: number, fulfilled: boolean) =>
  fetchJson<GoalToggleResponse>(
    `/api/goals/${encodeURIComponent(userId)}/toggle?index=${index}&fulfilled=${fulfilled}`,
    { method: 'POST' },
  );

export const simulateWearableSync = (userId: string) =>
  fetchJson<WearableSyncResponse>(`/api/simulate/${encodeURIComponent(userId)}`, { method: 'POST' });

export const simulateCalorieIntake = (userId: string, level: number, date?: string) => {
  const params = new URLSearchParams({ level: String(level) });
  if (date) params.set('date', date);
  return fetchJson<CalorieIntakeResponse>(
    `/api/simulate/${encodeURIComponent(userId)}/calories?${params}`,
    { method: 'POST' },
  );
};

export const simulateExercise = (userId: string, date?: string) => {
  const params = date ? `?date=${date}` : '';
  return fetchJson<ExerciseResponse>(
    `/api/simulate/${encodeURIComponent(userId)}/exercise${params}`,
    { method: 'POST' },
  );
};

export const simulateActiveExercise = (userId: string) =>
  fetchJson<SimulateMessageResponse>(
    `/api/simulate/${encodeURIComponent(userId)}/exercise/active`,
    { method: 'POST' },
  );

export const extendActiveExercise = (exerciseId: string, minutes = 20) =>
  fetchJson<SimulateMessageResponse>(
    `/api/simulate/exercise/${encodeURIComponent(exerciseId)}/extend?minutes=${minutes}`,
    { method: 'POST' },
  );

export const finishActiveExercise = (exerciseId: string) =>
  fetchJson<SimulateMessageResponse>(
    `/api/simulate/exercise/${encodeURIComponent(exerciseId)}/finish`,
    { method: 'POST' },
  );

export async function streamChat(
  message: string,
  userId: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  photo?: File | null,
  intent?: string,
) {
  const fd = new FormData();
  fd.append('Message', message);
  fd.append('UserId', userId);
  if (intent) fd.append('Intent', intent);
  if (photo) fd.append('Photo', photo);

  const res = await fetch(`${BASE_URL}/api/chat`, { method: 'POST', body: fd });
  if (!res.ok || !res.body) {
    onChunk('Error connecting to chat.');
    onDone();
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line === '') { currentEvent = null; continue; }
      if (line.startsWith('event: ')) { currentEvent = line.slice(7); continue; }
      if (!line.startsWith('data: ')) continue;

      const parsed = JSON.parse(line.slice(6));
      if (currentEvent === 'final') continue;
      if (currentEvent === 'error') {
        onChunk(`⚠️ ${parsed?.error ?? 'Coach hit a problem.'}`);
        continue;
      }
      if (typeof parsed === 'string') onChunk(parsed);
    }
  }
  onDone();
}

export const getPeerStanding = (userId: string, period: 'week' | 'month' | 'year' = 'week') =>
  fetchJson<PeerStandingResponse>(
    `/api/trends/peer-standing/${encodeURIComponent(userId)}?period=${period}`,
  );

export const getLiveWorkouts = () =>
  fetchJson<LiveWorkoutsResponse>('/api/live/workouts');

export const liveWorkoutsStreamUrl = (): string => `${BASE_URL}/api/live/workouts/stream`;

export const getFriends = (userId: string) =>
  fetchJson<FriendsResponse>(`/api/friends/${encodeURIComponent(userId)}`);

export const followUser = (userId: string, otherUserId: string) =>
  fetchJson<FollowsResponse>(
    `/api/friends/${encodeURIComponent(userId)}/follow/${encodeURIComponent(otherUserId)}`,
    { method: 'POST' },
  );

export const unfollowUser = (userId: string, otherUserId: string) =>
  fetchJson<FollowsResponse>(
    `/api/friends/${encodeURIComponent(userId)}/follow/${encodeURIComponent(otherUserId)}`,
    { method: 'DELETE' },
  );

export const getFeed = async (userId: string, limit = 50): Promise<FeedResponse> => {
  if (!FITFEED_URL) return { userId, items: [] };
  const res = await fetch(`${FITFEED_URL}/api/feed/${encodeURIComponent(userId)}?limit=${limit}`);
  if (!res.ok) throw new Error(`FitFeed error: ${res.status}`);
  return res.json();
};

export const getAchievements = async (userId: string): Promise<Achievements> => {
  if (!FITFEED_URL) {
    return { userId, currentStreakDays: 0, longestStreakDays: 0, level: 1, lifetimeWorkouts: 0, lifetimeKcalBurned: 0 };
  }
  const res = await fetch(`${FITFEED_URL}/api/achievements/${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error(`FitFeed error: ${res.status}`);
  return res.json();
};

export function streamFeed(
  userId: string,
  onItem: (item: FeedItem) => void,
  onError?: (err: Event) => void,
): () => void {
  if (!FITFEED_URL) return () => {};
  const source = new EventSource(`${FITFEED_URL}/feed/${encodeURIComponent(userId)}/live`);
  source.onmessage = (e) => {
    try { onItem(JSON.parse(e.data) as FeedItem); }
    catch { /* swallow malformed frame */ }
  };
  source.onerror = (e) => { onError?.(e); };
  return () => source.close();
}

export const getTrends = (period: 'week' | 'month' | 'year', userId?: string) => {
  const qs = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  return fetchJson<TrendsResponse>(`/api/trends/${period}${qs}`);
};

export const getPipelineStats = () => fetchJson<PipelineStats>('/api/admin/pipeline-stats');

export const runOlapEtl = () =>
  fetchJson<{ message: string }>('/api/admin/olap-etl/run', { method: 'POST' });

export const seedAll = () => fetchJson<SeedResponse>('/api/seed/all', { method: 'POST' });

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

export type {
  Exercise,
  LiveWorkout, PeerStandingResponse,
  DailyGoalsResponse, DailyGoalItem,
  FriendSummary, FeedItem, Achievements,
  TrendingType, DailyVolumePoint, UserVsPlatformRow, TrendsResponse, YourPeerStanding,
  PipelineStats, PipelineEvent,
} from './apiTypes';
