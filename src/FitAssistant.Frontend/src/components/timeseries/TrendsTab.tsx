import React, { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { getTrends, runOlapEtl, YourPeerStanding } from '../../api';
import { Skeleton } from '../common/Skeleton';
import './TrendsTab.css';

type Period = 'week' | 'month' | 'year';

interface TrendsTabProps {
  userId: string;
  refreshKey: number;
}

const PERIOD_LABEL: Record<Period, string> = {
  week:  'this week',
  month: 'this month',
  year:  'this year',
};

const PERIOD_AVG_LABEL: Record<Period, string> = {
  week:  'last 7 days',
  month: 'last 30 days',
  year:  'last 365 days',
};

/**
 * Cross-user analytical surface — backed by DuckDB-over-Parquet (per ADR-0004).
 * The display is anchored on the active persona ("Your week first"), with
 * platform-wide context underneath:
 *
 *   1. Your <period> — 4 stat cards (workouts, kcal, minutes, kcal-vs-platform).
 *   2. Most-used exercises this <period> · all members — leaderboard with
 *      per-session averages (kcal AND minutes), not just totals.
 *   3. Your performance per session vs platform — paired columns with
 *      explicit "/session" units, both kcal and duration.
 *   4. Daily volume · all members — bar chart with session counts overlaid.
 *
 * Freshness is bounded by the OLAP ETL flush cadence (default 60 s, cron-
 * driven). The "Flush OLAP now" button in the head forces an immediate
 * toggle-off/on so a presenter doesn't have to wait the full minute.
 */
export const TrendsTab: React.FC<TrendsTabProps> = ({ userId, refreshKey }) => {
  const [period, setPeriod] = useState<Period>('week');
  const [localRefresh, setLocalRefresh] = useState(0);
  const [flushing, setFlushing] = useState(false);
  const [flushMsg, setFlushMsg] = useState<string | null>(null);
  const trends = useApi(() => getTrends(period, userId), [userId, period, refreshKey, localRefresh]);

  const handleFlush = async () => {
    if (flushing) return;
    setFlushing(true);
    setFlushMsg('Flushing…');
    try {
      const r = await runOlapEtl();
      setFlushMsg(r.message);
      window.setTimeout(() => setLocalRefresh(k => k + 1), 1500);
      window.setTimeout(() => setFlushMsg(null), 4000);
    } catch (e: any) {
      setFlushMsg(`Failed: ${e?.message ?? 'unknown'}`);
      window.setTimeout(() => setFlushMsg(null), 4000);
    } finally {
      setFlushing(false);
    }
  };

  return (
    <div className="trends-tab">
      <div className="trends-tab__head">
        <PeriodTabs value={period} onChange={setPeriod} />
        <button
          type="button"
          className="trends-tab__flush"
          onClick={handleFlush}
          disabled={flushing}
          title="Toggle the OLAP ETL off/on to flush pending Parquet writes immediately, instead of waiting for the next cron tick."
        >
          {flushing ? 'Flushing…' : 'Flush OLAP now'}
        </button>
        {flushMsg && <span className="trends-tab__flush-msg">{flushMsg}</span>}
      </div>

      {trends.loading && !trends.data ? (
        <div className="trends-tab__loading">
          <Skeleton width="100%" height="120px" />
          <div style={{ height: 12 }} />
          <Skeleton width="100%" height="160px" />
        </div>
      ) : trends.error || !trends.data ? (
        <div className="trends-tab__empty">
          Couldn't load trends. The OLAP ETL may not have flushed any Parquet
          files yet — log a workout, wait ~1 minute, and refresh.
        </div>
      ) : (
        <>
          {trends.data.you && (
            <YourStandingRibbon you={trends.data.you} period={period} />
          )}

          <Section
            title={`Most-used exercises ${PERIOD_LABEL[period]} · all members`}
            hint={`Ranked by session count across every user, ${PERIOD_AVG_LABEL[period]}.`}
          >
            {trends.data.trendingTypes.length === 0 ? (
              <p className="trends-tab__empty">No platform data for this window yet — try a wider period or wait for the next OLAP flush.</p>
            ) : (
              <table className="trends-tab__compare">
                <thead>
                  <tr>
                    <th>Exercise type</th>
                    <th>Sessions (all)</th>
                    <th>Avg kcal/session</th>
                    <th>Avg min/session</th>
                    <th>Total kcal</th>
                  </tr>
                </thead>
                <tbody>
                  {trends.data.trendingTypes.map(t => (
                    <tr key={t.exerciseType}>
                      <td>{t.exerciseType}</td>
                      <td>{t.sessionCount.toLocaleString()}</td>
                      <td>{Math.round(t.avgKcalPerSession).toLocaleString()}</td>
                      <td>{Math.round(t.avgDurationMinutes)}</td>
                      <td className="trends-tab__muted">{t.totalCaloriesBurned.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {trends.data.userVsPlatform && trends.data.userVsPlatform.length > 0 && (
            <Section
              title="Your performance per session vs platform"
              hint="One row per exercise type you've logged. Δ% compares your per-session average to the platform average."
            >
              <table className="trends-tab__compare">
                <thead>
                  <tr>
                    <th>Exercise type</th>
                    <th>Your kcal/session</th>
                    <th>Platform kcal/session</th>
                    <th>Your min/session</th>
                    <th>Platform min/session</th>
                    <th>Your sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {trends.data.userVsPlatform.map(row => {
                    const kcalDelta = row.platformAvgKcal === 0 ? 0
                      : ((row.yourAvgKcal - row.platformAvgKcal) / row.platformAvgKcal) * 100;
                    return (
                      <tr key={row.exerciseType}>
                        <td>{row.exerciseType}</td>
                        <td>
                          {Math.round(row.yourAvgKcal)}
                          <DeltaPill pct={kcalDelta} />
                        </td>
                        <td className="trends-tab__muted">{Math.round(row.platformAvgKcal)}</td>
                        <td>{Math.round(row.yourAvgMinutes)}</td>
                        <td className="trends-tab__muted">{Math.round(row.platformAvgMinutes)}</td>
                        <td>{row.yourSessions}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Section>
          )}

          <Section
            title={`Daily session volume · all members`}
            hint={`Total sessions per day, ${PERIOD_AVG_LABEL[period]}.`}
          >
            <DailyVolumeChart points={trends.data.dailyVolume} />
          </Section>
        </>
      )}
    </div>
  );
};

const PeriodTabs: React.FC<{ value: Period; onChange: (p: Period) => void }> = ({ value, onChange }) => (
  <div className="trends-tab__period" role="tablist">
    {(['week', 'month', 'year'] as Period[]).map(p => (
      <button
        key={p}
        role="tab"
        aria-selected={value === p}
        className={`trends-tab__period-tab ${value === p ? 'is-active' : ''}`}
        onClick={() => onChange(p)}
      >
        {p.charAt(0).toUpperCase() + p.slice(1)}
      </button>
    ))}
  </div>
);

const Section: React.FC<{ title: string; hint?: string; children: React.ReactNode }> =
  ({ title, hint, children }) => (
    <section className="trends-tab__section">
      <div className="trends-tab__section-head">
        <h4 className="trends-tab__section-title">{title}</h4>
        {hint && <span className="trends-tab__section-hint">{hint}</span>}
      </div>
      {children}
    </section>
  );

/** Lead ribbon — three KpiTile cards driven by data that genuinely requires
 *  the OLAP path: peer percentiles over the period (PERCENT_RANK across all
 *  members) and the user's kcal/session delta vs everyone else. Totals/counts
 *  are deliberately excluded; those are answerable from RavenDB alone and
 *  already live on the dashboard and Activities tabs. */
const YourStandingRibbon: React.FC<{ you: YourPeerStanding; period: Period }> = ({ you, period }) => {
  if (you.totalMembers === 0) {
    return (
      <p className="trends-tab__empty">
        No platform workouts in this window yet — peer ranks need at least one
        member with data. Log a workout (or simulate one) and OLAP-flush.
      </p>
    );
  }

  // Only one member with activity (likely just you in early demo state): peer
  // metrics are meaningless. Show a soft empty rather than a 100% gauge.
  if (you.totalMembers < 2) {
    return (
      <p className="trends-tab__empty">
        You're the only member with workouts {PERIOD_LABEL[period]}. Peer ranks
        activate once a second member logs a session.
      </p>
    );
  }

  return (
    <section className="trends-tab__standing" aria-label={`Your standing ${PERIOD_LABEL[period]}`}>
      <StandingTile
        testId="trends-rank-kcal"
        tone="orange"
        label="Kcal rank"
        value={`${Math.round(you.kcalPercentile)}%`}
        hint={`top by total kcal · ${you.totalMembers} members`}
        visual={<PercentileBar value={you.kcalPercentile} tone="orange" />}
      />
      <StandingTile
        testId="trends-rank-sessions"
        tone="purple"
        label="Workout rank"
        value={`${Math.round(you.sessionsPercentile)}%`}
        hint={`top by session count · ${you.totalMembers} members`}
        visual={<PercentileBar value={you.sessionsPercentile} tone="purple" />}
      />
      <StandingTile
        testId="trends-effort-delta"
        tone="blue"
        label="Effort vs others"
        value={formatDelta(you.kcalPerSessionDeltaPct)}
        hint={
          you.kcalPerSessionDeltaPct === null
            ? 'no peer data in this window'
            : 'avg kcal/session — you vs others'
        }
        visual={<DeltaDial pct={you.kcalPerSessionDeltaPct} />}
      />
    </section>
  );
};

/** Compact standing tile — slim two-row card sized for nested-tab content,
 *  not the full-size dashboard KpiTile. Top row is label + feature badge;
 *  bottom row is the big value next to a small visual (percentile bar or
 *  delta dial). About half the vertical footprint of KpiTile. */
const StandingTile: React.FC<{
  testId?: string;
  tone: 'orange' | 'purple' | 'blue';
  label: string;
  value: string;
  hint?: string;
  badge?: React.ReactNode;
  visual?: React.ReactNode;
}> = ({ testId, tone, label, value, hint, badge, visual }) => (
  <div className={`trends-standing-tile trends-standing-tile--${tone}`} data-testid={testId}>
    <div className="trends-standing-tile__head">
      <span className="trends-standing-tile__label">{label}</span>
      {badge}
    </div>
    <div className="trends-standing-tile__body">
      <div className="trends-standing-tile__valueArea">
        <span className="trends-standing-tile__value">{value}</span>
        {hint && <span className="trends-standing-tile__hint">{hint}</span>}
      </div>
      {visual && <div className="trends-standing-tile__visual">{visual}</div>}
    </div>
  </div>
);

function formatDelta(pct: number | null): string {
  if (pct === null) return '—';
  const sign = pct >= 0 ? '+' : '−';
  return `${sign}${Math.abs(pct).toFixed(0)}%`;
}

/** Compact percentile bar matching the dashboard's Peer Rank tile visual.
 *  Tone-dotted via CSS custom properties so the same component can render
 *  in any KpiTone without forking the markup. */
const PercentileBar: React.FC<{ value: number; tone: 'orange' | 'purple' | 'blue' }> = ({ value, tone }) => {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={`trends-percentile trends-percentile--${tone}`} aria-hidden="true">
      <div className="trends-percentile__bar" style={{ ['--p' as any]: `${clamped}%` }}>
        <span className="trends-percentile__fill" />
        <span className="trends-percentile__pin" />
      </div>
      <div className="trends-percentile__legend">
        <span>0</span>
        <span>peers</span>
        <span>top</span>
      </div>
    </div>
  );
};

/** Center-zero "dial" for the delta vs everyone-else: a horizontal track with
 *  a needle that sits at 50% for zero and slides toward the ends as |delta|
 *  grows. Range is capped at ±50% — far enough out we just stick at the rail. */
const DeltaDial: React.FC<{ pct: number | null }> = ({ pct }) => {
  if (pct === null) {
    return <div className="trends-dial trends-dial--empty" aria-hidden="true" />;
  }
  const clamped = Math.max(-50, Math.min(50, pct));
  const left = 50 + clamped;          // 0% → 50%, +50% → 100%, -50% → 0%
  const sign = pct >= 0 ? 'is-up' : 'is-down';
  return (
    <div className={`trends-dial ${sign}`} aria-hidden="true">
      <div className="trends-dial__track">
        <span className="trends-dial__zero" />
        <span className="trends-dial__needle" style={{ left: `${left}%` }} />
      </div>
      <div className="trends-dial__legend">
        <span>−50%</span>
        <span>peers</span>
        <span>+50%</span>
      </div>
    </div>
  );
};

/** Tiny ±N% pill used inline in the per-type comparison table. */
const DeltaPill: React.FC<{ pct: number; label?: string }> = ({ pct, label }) => {
  if (!isFinite(pct)) return null;
  const up = pct >= 0;
  const rounded = Math.abs(pct).toFixed(0);
  return (
    <span className={`trends-tab__delta ${up ? 'is-up' : 'is-down'}`}>
      {up ? '↑' : '↓'} {rounded}%
      {label && <span className="trends-tab__delta-label"> {label}</span>}
    </span>
  );
};

/** CSS bar chart — sessions per day, count overlaid on each bar so the value
 *  is readable without hovering. Avoids pulling in recharts for one widget. */
const DailyVolumeChart: React.FC<{ points: { day: string; sessions: number; totalKcal: number }[] }> = ({ points }) => {
  if (points.length === 0) {
    return (
      <p className="trends-tab__empty">
        No daily breakdown for this window yet. (If you just logged a workout, click "Flush OLAP now" — Parquet writes are cron-driven.)
      </p>
    );
  }
  const max = Math.max(...points.map(p => p.sessions), 1);
  return (
    <div className="trends-tab__bars" aria-label="Daily session volume">
      {points.map(p => {
        const h = (p.sessions / max) * 100;
        const dayLabel = new Date(p.day).toLocaleDateString(undefined, { weekday: 'short' });
        return (
          <div key={p.day} className="trends-tab__bar" title={`${dayLabel} — ${p.sessions} session${p.sessions === 1 ? '' : 's'}, ${p.totalKcal.toLocaleString()} kcal`}>
            <span className="trends-tab__bar-count" aria-hidden="true">{p.sessions}</span>
            <span className="trends-tab__bar-fill" style={{ height: `${h}%` }} />
            <span className="trends-tab__bar-label">{dayLabel}</span>
          </div>
        );
      })}
    </div>
  );
};
