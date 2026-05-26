import React, { useEffect, useMemo, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import {
  getExercises,
  simulateExercise,
  simulateActiveExercise,
  extendActiveExercise,
  finishActiveExercise,
  type Exercise,
} from '../../api';
import { Button } from '../common/Button';
import { Skeleton } from '../common/Skeleton';
import { useToast } from '../../hooks/useToast';
import { Range } from './RangeChips';
import { ChartEmpty } from './HeartRateTab';

interface ActivitiesTabProps {
  userId: string;
  range: Range;
  refreshKey: number;
  onLocalRefresh: () => void;
}

const ICONS: Record<string, string> = {
  Running: '🏃',
  Cycling: '🚴',
  HIIT: '⚡',
  'Strength Training': '🏋️',
  Swimming: '🏊',
  Yoga: '🧘',
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(today); yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export const ActivitiesTab: React.FC<ActivitiesTabProps> = ({
  userId,
  range,
  refreshKey,
  onLocalRefresh,
}) => {
  const { data, loading, error, reload } = useApi(
    () => getExercises(userId, range),
    [userId, range, refreshKey]
  );
  const toast = useToast();

  const handleAdd = async () => {
    try {
      const r = await simulateExercise(userId);
      toast.show({ tone: 'success', kind: 'workout', message: r.message });
      reload();
      onLocalRefresh();
    } catch {
      toast.show({ tone: 'error', kind: 'workout', message: 'Could not log workout' });
    }
  };

  const handleStartActive = async () => {
    try {
      const r = await simulateActiveExercise(userId);
      toast.show({ tone: 'success', kind: 'workout', message: r.message });
      reload();
      onLocalRefresh();
    } catch {
      toast.show({ tone: 'error', kind: 'workout', message: 'Could not start workout' });
    }
  };

  // Re-render every 15s so "live · Xm" stays current. (We no longer count
  // down to EndTime — LIVE is purely "endTime is null".)
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(id);
  }, []);

  // Pin live (in-progress) sessions to the top regardless of startTime.
  // LIVE = endTime is null (the doc's lifecycle marker).
  const exercises = useMemo(() => {
    const list = [...(data?.exercises ?? [])];
    return list.sort((a, b) => {
      const aLive = a.endTime === null;
      const bLive = b.endTime === null;
      if (aLive !== bLive) return aLive ? -1 : 1;
      return Date.parse(b.startTime) - Date.parse(a.startTime);
    });
    // tick is referenced to force re-sort when the 15s ticker bumps
  }, [data, tick]);

  return (
    <div className="ts-tab">
      <div className="ts-tab__head">
        <div className="ts-tab__stats">
          <Stat label="Sessions" value={`${exercises.length}`} />
          <Stat
            label="Cal burned"
            value={exercises.reduce((s: number, e: any) => s + (e.CaloriesBurned ?? e.caloriesBurned ?? 0), 0).toLocaleString('en-US')}
            unit="cal"
          />
        </div>
        <div className="ts-tab__cta">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleStartActive}
            testId="ex-start-active"
            iconLeft={<span aria-hidden="true">🟥</span>}
          >
            Start workout
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleAdd}
            testId="ex-log"
            iconLeft={<span aria-hidden="true">🏃</span>}
          >
            Log a workout
          </Button>
        </div>
      </div>

      <div className="ts-tab__list">
        {loading && exercises.length === 0 ? (
          <>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} width="100%" height="68px" radius={12} />
            ))}
          </>
        ) : error ? (
          <div className="ts-tab__empty">
            Couldn't load activities.{' '}
            <button type="button" className="ts-tab__retry" onClick={reload}>Retry</button>
          </div>
        ) : exercises.length === 0 ? (
          <ChartEmpty hint="No workouts in this range. Try Log a workout above or chat with the Coach." />
        ) : (
          <ul className="activities">
            {exercises.map((ex) => {
              const sid = ex.id ?? '';
              return (
                <ActivityRow
                  key={sid || ex.startTime}
                  exercise={ex}
                  onExtend={async () => {
                    try {
                      const r = await extendActiveExercise(sid, 20);
                      toast.show({ tone: 'success', kind: 'workout', message: r.message });
                      reload();
                      onLocalRefresh();
                    } catch {
                      toast.show({ tone: 'error', kind: 'workout', message: 'Could not extend session' });
                    }
                  }}
                  onFinish={async () => {
                    try {
                      const r = await finishActiveExercise(sid);
                      toast.show({ tone: 'success', kind: 'workout', message: r.message });
                      reload();
                      onLocalRefresh();
                    } catch {
                      toast.show({ tone: 'error', kind: 'workout', message: 'Could not finish session' });
                    }
                  }}
                />
              );
            })}
          </ul>
        )}
      </div>

    </div>
  );
};

const ActivityRow: React.FC<{
  exercise: Exercise;
  onExtend?: () => void;
  onFinish?: () => void;
}> = ({ exercise, onExtend, onFinish }) => {
  const { type, startTime, endTime, durationMinutes } = exercise;
  const cal = exercise.caloriesBurned;
  // Auto-coach note — populated ONCE by the AutoCoachWorker subscription on
  // commit (Ultra users). Read from the document on every render — no per-row
  // LLM call. Free users see this stay null; nothing fakes a note.
  const coachNote = exercise.coachNote ?? null;

  // LIVE = doc's lifecycle marker. endTime is null while the workout is in
  // progress; FinishActiveExercise flips it to a real timestamp.
  const isLive = endTime === null;
  const minutesLive = isLive
    ? Math.max(0, Math.floor((Date.now() - Date.parse(startTime)) / 60_000))
    : 0;

  return (
    <li
      className={`activity${isLive ? ' activity--live' : ''}`}
      data-testid="activity-row"
    >
      <div className="activity__icon" aria-hidden="true">{ICONS[type] ?? '🔥'}</div>
      <div className="activity__main">
        <div className="activity__row1">
          {isLive && (
            <span className="activity__live-pill" aria-label="Live workout">
              <span className="activity__live-dot" />LIVE
            </span>
          )}
          <span className="activity__type">{type}</span>
          <span className="activity__date">
            {isLive ? `live · ${minutesLive}m elapsed` : `${fmtDate(startTime)} · ${fmtTime(startTime)}`}
          </span>
          {isLive && (onExtend || onFinish) && (
            <span className="activity__live-actions">
              {onExtend && (
                <button
                  type="button"
                  className="activity__live-btn"
                  data-testid="activity-extend"
                  title="Add 20 minutes to elapsed time"
                  onClick={(e) => { e.stopPropagation(); onExtend(); }}
                >
                  +20m
                </button>
              )}
              {onFinish && (
                <button
                  type="button"
                  className="activity__live-btn activity__live-btn--finish"
                  data-testid="activity-finish"
                  title="Finish this session now"
                  onClick={(e) => { e.stopPropagation(); onFinish(); }}
                >
                  ✓ Finish
                </button>
              )}
            </span>
          )}
        </div>
        <div className="activity__row2">
          {/* Live rows show elapsed (now − StartTime). The stored DurationMinutes
              is the planned total written at start and only gets recomputed to
              actual elapsed on extend / finish. */}
          <span>{isLive ? minutesLive : durationMinutes} min</span>
          <span className="activity__sep" aria-hidden="true">·</span>
          <span>{cal} cal</span>
        </div>
        {coachNote && (
          <div className="activity__coach" data-testid="activity-coach-note">
            <span className="activity__coach-mark" aria-hidden="true">🧑‍🏫</span>
            <span className="activity__coach-text">{coachNote}</span>
          </div>
        )}
      </div>
    </li>
  );
};

const Stat: React.FC<{ label: string; value: string; unit?: string }> = ({ label, value, unit }) => (
  <div className="ts-tab__stat">
    <span className="ts-tab__stat-label">{label}</span>
    <span className="ts-tab__stat-value">
      {value}
      {unit && <span className="ts-tab__stat-unit"> {unit}</span>}
    </span>
  </div>
);
