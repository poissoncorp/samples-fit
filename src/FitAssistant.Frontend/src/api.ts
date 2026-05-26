/**
 * API router. Switches between the real backend and the in-browser mock
 * based on a runtime flag. Set via:
 *   - URL: ?mock=1   (sticks for the session)
 *   - Console: localStorage.setItem('fit-assistant-mock', '1'); location.reload()
 *   - Console: localStorage.removeItem('fit-assistant-mock'); location.reload()
 *
 * Default: real backend (REACT_APP_BACKEND_URL).
 *
 * The mock module exports the exact same surface as api.real, so consumer
 * code is identical. Both share the same JSON shapes.
 */

import * as real from './api.real';
import * as mock from './api.mock';

const FLAG_KEY = 'fit-assistant-mock';

function readMockFlag(): boolean {
  if (typeof window === 'undefined') return false;
  // URL param wins and persists into localStorage for the session.
  const url = new URLSearchParams(window.location.search);
  if (url.has('mock')) {
    const v = url.get('mock');
    if (v === '1' || v === 'true') {
      window.localStorage.setItem(FLAG_KEY, '1');
      return true;
    }
    if (v === '0' || v === 'false') {
      window.localStorage.removeItem(FLAG_KEY);
      return false;
    }
  }
  return window.localStorage.getItem(FLAG_KEY) === '1';
}

const isMock = readMockFlag();
const impl: typeof real = isMock ? (mock as unknown as typeof real) : real;

if (typeof window !== 'undefined' && isMock) {
  // eslint-disable-next-line no-console
  console.info('%c[fit-assistant] mock API active', 'color:#af52de;font-weight:600');
}

export const getUsers = impl.getUsers;
export const getUser = impl.getUser;
export const getFitnessGoals = impl.getFitnessGoals;
export const generateUser = impl.generateUser;
export const getHeartRate = impl.getHeartRate;
export const getCalories = impl.getCalories;
export const getExercises = impl.getExercises;
export const getDailyGoals = impl.getDailyGoals;
export const toggleGoalFulfillment = impl.toggleGoalFulfillment;
export const simulateWearableSync = impl.simulateWearableSync;
export const simulateCalorieIntake = impl.simulateCalorieIntake;
export const simulateExercise = impl.simulateExercise;
export const simulateActiveExercise = impl.simulateActiveExercise;
export const extendActiveExercise = impl.extendActiveExercise;
export const finishActiveExercise = impl.finishActiveExercise;
export const streamChat = impl.streamChat;
export const seedAll = impl.seedAll;
export const getPeerStanding = impl.getPeerStanding;
export const getLiveWorkouts = impl.getLiveWorkouts;
export const liveWorkoutsStreamUrl = impl.liveWorkoutsStreamUrl;

// Track C — outbound data movement (ADR-0004)
export const getFriends = impl.getFriends;
export const followUser = impl.followUser;
export const unfollowUser = impl.unfollowUser;
export const getFeed = impl.getFeed;
export const getAchievements = impl.getAchievements;
export const streamFeed = impl.streamFeed;
export const getTrends = impl.getTrends;
export const getPipelineStats = impl.getPipelineStats;
export const runOlapEtl = impl.runOlapEtl;

// Re-export the type aliases for components that consume the response shapes.
export type {
  Exercise,
  LiveWorkout, PeerStandingResponse,
  DailyGoalsResponse, DailyGoalItem,
  FriendSummary, FeedItem, Achievements,
  TrendingType, DailyVolumePoint, UserVsPlatformRow, TrendsResponse, YourPeerStanding,
  PipelineStats, PipelineEvent,
} from './apiTypes';
export const isMockMode = isMock;
