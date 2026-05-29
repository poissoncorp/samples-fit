import React, { useEffect, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { getDailyGoals, toggleGoalFulfillment, type DailyGoalsResponse } from '../../api';
import { FeatureBadge } from '../common/FeatureBadge';
import { Skeleton } from '../common/Skeleton';
import './DailyGoalsCard.css';

interface DailyGoalsCardProps {
  userId: string;
  refreshKey?: number;
}

/**
 * The dashboard's daily-goals card. Three AI-generated daily goals per user
 * plus a one-line motivator, produced by the server-side `daily-goals`
 * GenAI Task watching the UserProfiles collection. Time-driven by `@refresh`
 * (24h cadence). Spurious retriggers on Name / Theme / IsPremium edits cost
 * zero tokens because RavenDB's built-in `@ai-hashes` elides the AI call
 * when the context object is unchanged.
 *
 * Two fulfilment paths:
 *   1. Auto — BURN / INTAKE predicates (`{ type, amount }`) are evaluated by
 *      the `AutoFulfillGoalsFromActivity` subscriptions on ExerciseSession +
 *      FoodEntry writes. Cumulative-today kcal crossing the threshold flips
 *      Fulfilled = true.
 *   2. Manual — the user clicks the checkbox (for goals with no predicate
 *      like mobility / sleep / hydration, OR to override the auto path).
 *
 * Either way, the patch fires the downstream `FanOutFulfilledGoals`
 * subscription that broadcasts a `goal.progress` event (X/N count) to
 * friends via the activity_feed RabbitMQ queue.
 */
export const DailyGoalsCard: React.FC<DailyGoalsCardProps> = ({ userId, refreshKey = 0 }) => {
  const [localPoll, setLocalPoll] = useState(0);
  const goals = useApi<DailyGoalsResponse>(() => getDailyGoals(userId), [userId, refreshKey, localPoll]);
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  // Tick the "next refresh in" countdown.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const data = goals.data;
  const isPending = data?.ready === false;

  // Re-poll while pending — the AI may land any second.
  useEffect(() => {
    if (!isPending) return;
    const id = window.setInterval(() => setLocalPoll(p => p + 1), 3000);
    return () => window.clearInterval(id);
  }, [isPending]);

  const handleToggle = async (idx: number, nextFulfilled: boolean) => {
    if (busyIndex !== null) return;
    setBusyIndex(idx);
    try {
      await toggleGoalFulfillment(userId, idx, nextFulfilled);
      setLocalPoll(p => p + 1);
    } finally {
      setBusyIndex(null);
    }
  };

  if (goals.loading && !data) {
    return (
      <section className="daily-goals-card">
        <Header generatedAt={null} nextRefreshLabel="…" />
        <Skeleton width="100%" height="20px" />
        <div style={{ height: 4 }} />
        <Skeleton width="92%" height="20px" />
        <div style={{ height: 4 }} />
        <Skeleton width="86%" height="20px" />
      </section>
    );
  }

  if (!data || !data.ready) {
    return (
      <section className="daily-goals-card">
        <Header generatedAt={null} nextRefreshLabel="generating…" />
        <p className="daily-goals-card__empty">
          The GenAI Task is producing today's goals — the @refresh heartbeat on
          your profile fires shortly after seed / signup. This will populate
          within a few seconds.
        </p>
      </section>
    );
  }

  const nextRefreshMs = data.generatedAt
    ? new Date(data.generatedAt).getTime() + data.cadenceSeconds * 1000
    : null;
  const remainingMs = nextRefreshMs ? Math.max(0, nextRefreshMs - now) : null;

  return (
    <section className="daily-goals-card">
      <Header
        generatedAt={data.generatedAt ?? null}
        nextRefreshLabel={remainingMs !== null ? formatRemaining(remainingMs) : '—'}
      />

      {data.motivation && (
        <p className="daily-goals-card__motivation">"{data.motivation}"</p>
      )}

      <ul className="daily-goals-card__list">
        {(data.goals ?? []).map((g, i) => {
          const predicate = g.predicate ?? null;
          const kind = predicate?.type ?? 'manual';            // 'BURN' | 'INTAKE' | 'manual'
          const kindClass = kind === 'BURN' ? 'burn' : kind === 'INTAKE' ? 'intake' : 'manual';
          const kindLabel = kind === 'BURN' ? 'auto · burn' : kind === 'INTAKE' ? 'auto · intake' : 'manual';
          const isAuto = predicate !== null;
          const hint = kind === 'BURN'
            ? `Auto-fulfills when today's cumulative calories burned reach ${predicate?.amount ?? '?'}.`
            : kind === 'INTAKE'
              ? `Auto-fulfills when today's cumulative calorie intake reaches ${predicate?.amount ?? '?'}.`
              : g.fulfilled ? 'Mark unfulfilled' : 'Tap to mark fulfilled — broadcasts to friends';
          return (
            <li
              key={i}
              className={`daily-goals-card__item ${g.fulfilled ? 'is-done' : ''}`}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={g.fulfilled}
                aria-disabled={isAuto}
                className={`daily-goals-card__check ${g.fulfilled ? 'is-checked' : ''} ${isAuto ? 'is-auto' : ''}`}
                onClick={() => { if (!isAuto) handleToggle(i, !g.fulfilled); }}
                disabled={isAuto || busyIndex !== null}
                title={hint}
              >
                {g.fulfilled ? '✓' : ''}
              </button>
              <span className="daily-goals-card__text">{g.text}</span>
              <span className={`daily-goals-card__pill daily-goals-card__pill--${kindClass}`}>
                {kindLabel}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

const Header: React.FC<{ generatedAt: string | null; nextRefreshLabel: string }> = ({
  generatedAt,
  nextRefreshLabel,
}) => (
  <div className="daily-goals-card__head">
    <div className="daily-goals-card__title-row">
      <span className="daily-goals-card__title">Today's goals</span>
      <span className="daily-goals-card__badges">
        <FeatureBadge feature="genai-advanced" />
        <FeatureBadge feature="document-refresh" />
        <FeatureBadge feature="ai-context-hashes" />
        <FeatureBadge feature="tool-queries" />
        <FeatureBadge feature="subscriptions" />
      </span>
    </div>
    <div className="daily-goals-card__sub">
      {generatedAt ? `Generated ${shortAgo(generatedAt, Date.now())} · next refresh in ${nextRefreshLabel}` : nextRefreshLabel}
    </div>
  </div>
);

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'now';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return r === 0 ? `${m}m` : `${m}m ${r}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function shortAgo(iso: string, nowMs: number): string {
  const diffS = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 1000));
  if (diffS < 60)   return `${diffS}s ago`;
  if (diffS < 3600) return `${Math.floor(diffS / 60)}m ago`;
  if (diffS < 86400) return `${Math.floor(diffS / 3600)}h ago`;
  return `${Math.floor(diffS / 86400)}d ago`;
}
