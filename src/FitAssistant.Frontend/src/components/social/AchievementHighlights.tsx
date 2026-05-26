import React from 'react';
import { Card } from '../common/Card';
import type { Achievements } from '../../api';

interface AchievementHighlightsProps {
  state: Achievements;
}

/**
 * Small per-user stat block at the top of the Social tab. State is
 * maintained by FitFeed's AchievementEngine — streaks, level (function of
 * lifetime kcal), lifetime totals — recomputed on every incoming workout.
 */
export const AchievementHighlights: React.FC<AchievementHighlightsProps> = ({ state }) => (
  <Card className="achievement-highlights">
    <Stat value={state.currentStreakDays} label="Day streak"        icon="🔥" />
    <Stat value={`Lv ${state.level}`}      label={`${state.lifetimeKcalBurned.toLocaleString()} kcal lifetime`} icon="⚡" />
    <Stat value={state.lifetimeWorkouts}   label="Workouts logged"  icon="🏆" />
    <Stat value={state.longestStreakDays}  label="Longest streak"   icon="📈" />
  </Card>
);

const Stat: React.FC<{ value: string | number; label: string; icon: string }> = ({ value, label, icon }) => (
  <div className="achievement-highlights__stat">
    <span className="achievement-highlights__icon" aria-hidden="true">{icon}</span>
    <span className="achievement-highlights__value">{value}</span>
    <span className="achievement-highlights__label">{label}</span>
  </div>
);
