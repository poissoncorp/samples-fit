import React, { useMemo } from 'react';
import { useApi } from '../../hooks/useApi';
import { getCalories, getExercises, getHeartRate, getUser, getPeerStanding } from '../../api';
import { KpiTile } from './KpiTile';
import { ProgressRing } from './ProgressRing';
import { FeatureBadge } from '../common/FeatureBadge';
import './KpiRibbon.css';

interface KpiRibbonProps {
  userId: string;
  /** Bumped externally to force a refetch (e.g. after a tab-local action
   *  like "Log a meal" or "Sync wearable"). */
  refreshKey?: number;
}

const KCAL_FALLBACK_GOAL = 2200;

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

export const KpiRibbon: React.FC<KpiRibbonProps> = ({ userId, refreshKey = 0 }) => {
  const user = useApi(() => getUser(userId), [userId, refreshKey]);
  const calories = useApi(() => getCalories(userId, '7d'), [userId, refreshKey]);
  const heartRate = useApi(() => getHeartRate(userId, '7d'), [userId, refreshKey]);
  const exercises = useApi(() => getExercises(userId, '7d'), [userId, refreshKey]);
  const peerStanding = useApi(() => getPeerStanding(userId, 'week'), [userId, refreshKey]);

  const goal = (user.data?.dailyCalorieGoal as number | undefined) ?? KCAL_FALLBACK_GOAL;

  // ----- Calories Today (intake) -----------------------------------------
  const intakeToday = useMemo(() => {
    const arr = calories.data?.intake ?? [];
    if (arr.length === 0) return 0;
    return arr[arr.length - 1].total;
  }, [calories.data]);

  // ----- Burned today (today's row from the burned map-reduce index) -----
  const burnedToday = useMemo(() => {
    const arr = calories.data?.burned ?? [];
    if (arr.length === 0) return 0;
    return arr[arr.length - 1].total;
  }, [calories.data]);

  // ----- Calorie balance (frontend-computed) ----------------------------
  // balance = intake − burned. Positive = net consumed (typical);
  // negative = burned more than eaten (atypical, but possible).
  const balanceToday = intakeToday - burnedToday;

  // ----- Resting HR (low percentile of last 24h) -------------------------
  const { restingBpm, hrTrendDelta } = useMemo(() => {
    const points = heartRate.data ?? [];
    if (points.length === 0) return { restingBpm: null as number | null, hrTrendDelta: 0 };

    // Take low-quartile bpm as a "resting" proxy.
    const sorted = [...points].map((p) => p.bpm).sort((a, b) => a - b);
    const recent = sorted.slice(0, Math.max(1, Math.floor(sorted.length * 0.25)));
    const restingBpm = Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);

    // Compare last-24h resting to prior days for trend
    const cutoff = Date.now() - 24 * 3600 * 1000;
    const recentPts = points.filter((p) => Date.parse(p.timestamp) >= cutoff).map((p) => p.bpm);
    const olderPts = points.filter((p) => Date.parse(p.timestamp) < cutoff).map((p) => p.bpm);
    const recentLow = recentPts.length
      ? recentPts.sort((a, b) => a - b).slice(0, Math.max(1, Math.floor(recentPts.length * 0.25)))
      : [];
    const olderLow = olderPts.length
      ? olderPts.sort((a, b) => a - b).slice(0, Math.max(1, Math.floor(olderPts.length * 0.25)))
      : [];
    const recentMean = recentLow.length ? recentLow.reduce((a, b) => a + b, 0) / recentLow.length : 0;
    const olderMean = olderLow.length ? olderLow.reduce((a, b) => a + b, 0) / olderLow.length : recentMean;
    const hrTrendDelta = Math.round(recentMean - olderMean);

    return { restingBpm, hrTrendDelta };
  }, [heartRate.data]);

  // ----- Workouts (7d) -------------------------------------------------
  const { workoutCount, dayDots } = useMemo(() => {
    const list = exercises.data?.exercises ?? [];
    const days: boolean[] = new Array(7).fill(false);
    const now = new Date();
    list.forEach((e) => {
      const diff = Math.floor((now.getTime() - Date.parse(e.startTime)) / (24 * 3600 * 1000));
      if (diff >= 0 && diff < 7) days[6 - diff] = true;
    });
    return { workoutCount: list.length, dayDots: days };
  }, [exercises.data]);

  const heartIcon = (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M12 21s-7-4.35-9.33-9.06C.7 8.05 3.34 4 7.06 4 9.36 4 11 5.5 12 7c1-1.5 2.64-3 4.94-3C20.66 4 23.3 8.05 21.33 11.94 19 16.65 12 21 12 21z" />
    </svg>
  );
  const forkIcon = (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 3v6c0 1 0 3 2 3h0v9" />
      <path d="M11 3v6c0 1 0 3-2 3" />
      <path d="M17 3c-1 0-2 1-2 3v5c0 1 1 2 2 2v8" />
    </svg>
  );
  const runIcon = (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="14" cy="5" r="2" fill="currentColor" />
      <path d="M5 19l3-5 4-2 2 4 4 1" />
      <path d="M9 11l-2-3 4-2 3 2 0 3" />
    </svg>
  );

  const trendArrow =
    hrTrendDelta < -1 ? '↘' : hrTrendDelta > 1 ? '↗' : '→';
  const trendLabel =
    Math.abs(hrTrendDelta) < 2
      ? 'steady'
      : hrTrendDelta < 0
      ? `down ${Math.abs(hrTrendDelta)} bpm`
      : `up ${hrTrendDelta} bpm`;

  return (
    <section className="app-shell__ribbon" data-phase-slot="kpi-ribbon" aria-label="Daily summary">
      {/* Calories — intake + burned merged into one tile. Intake is the
          headline (ring viz + delta-to-goal); burned shows as a quieter
          secondary stat. Both halves come from the same map-reduce index
          family (KcalIntakeByUserDay + KcalBurnedByUserDay) so one badge
          honestly covers the pair. */}
      {/* Calorie balance today — frontend-computed from the two map-reduce
          indexes. balance = intake − burned. The hint shows the two halves
          (in / out) so the audience can see the arithmetic; the ring keeps
          the budget-consumed visual. */}
      <KpiTile
        testId="kpi-tile-calories"
        tone="blue"
        label="Calorie balance today"
        icon={forkIcon}
        loading={calories.loading || user.loading}
        value={fmt(balanceToday)}
        unit="cal"
        hint={
          <span className="kpi-calories-hint">
            <span>in {fmt(intakeToday)}</span>
            <span className="kpi-calories-hint__sep" aria-hidden="true">·</span>
            <span>out {fmt(burnedToday)}</span>
          </span>
        }
        badge={<FeatureBadge feature="map-reduce-index" />}
        visual={
          <ProgressRing
            value={intakeToday}
            max={goal}
            size={64}
            thickness={7}
            color="var(--ring-blue)"
            ariaLabel={`${fmt(intakeToday)} of ${fmt(goal)} calorie goal`}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-mute)' }}>
              {Math.round((intakeToday / goal) * 100)}%
            </span>
          </ProgressRing>
        }
      />

      <KpiTile
        testId="kpi-tile-hr"
        tone="red"
        label="Resting HR"
        icon={heartIcon}
        loading={heartRate.loading}
        value={restingBpm ?? '—'}
        unit="bpm"
        hint={`${trendArrow} ${trendLabel}`}
        badge={<FeatureBadge feature="time-series" />}
        visual={
          <ProgressRing
            value={Math.max(0, 80 - (restingBpm ?? 80))}
            max={30}
            size={64}
            thickness={7}
            color="var(--ring-red)"
            ariaLabel={`Resting heart rate ${restingBpm ?? '—'} beats per minute`}
          >
            <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
              {restingBpm ?? '—'}
            </span>
          </ProgressRing>
        }
      />

      <KpiTile
        testId="kpi-tile-workouts"
        tone="purple"
        label="Workouts (7d)"
        icon={runIcon}
        loading={exercises.loading}
        value={workoutCount}
        unit={workoutCount === 1 ? 'session' : 'sessions'}
        hint={
          workoutCount === 0
            ? 'No workouts yet — log one'
            : workoutCount >= 4
            ? 'Strong consistency'
            : 'Room for one more'
        }
        badge={<FeatureBadge feature="include" />}
        visual={
          <div className="kpi-dots" aria-hidden="true">
            {dayDots.map((on, i) => (
              <span key={i} className={`kpi-dots__dot ${on ? 'is-on' : ''}`} />
            ))}
          </div>
        }
      />

      <KpiTile
        testId="kpi-tile-percentile"
        tone="orange"
        label="Peer rank"
        icon={
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 17l4-6 5 4 5-9 4 5" />
            <circle cx="3" cy="17" r="1.4" fill="currentColor" stroke="none" />
            <circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none" />
            <circle cx="21" cy="11" r="1.4" fill="currentColor" stroke="none" />
          </svg>
        }
        loading={peerStanding.loading}
        value={
          peerStanding.data?.you
            ? `${Math.max(Math.round(peerStanding.data.you.kcalPercentile), 1)}%`
            : '—'
        }
        unit=""
        hint={
          peerStanding.data?.you
            ? `Top by kcal · ${peerStanding.data.you.totalMembers} peer${peerStanding.data.you.totalMembers === 1 ? '' : 's'} (7d)`
            : 'No peers yet'
        }
        badge={<FeatureBadge feature="olap-etl" />}
        visual={
          peerStanding.data?.you ? (
            <div className="kpi-percentile" aria-hidden="true">
              <div
                className="kpi-percentile__bar"
                style={{ ['--p' as any]: `${peerStanding.data.you.kcalPercentile}%` }}
              >
                <span className="kpi-percentile__fill" />
                <span className="kpi-percentile__pin" />
              </div>
              <div className="kpi-percentile__legend">
                <span>0</span>
                <span>peers</span>
                <span>top</span>
              </div>
            </div>
          ) : null
        }
      />
    </section>
  );
};
