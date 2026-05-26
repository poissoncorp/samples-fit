import React, { useEffect, useRef, useState } from 'react';
import { Achievements } from '../../api';
import { FeatureBadge } from '../common/FeatureBadge';
import { useClickOutside } from '../../hooks/useClickOutside';
import './TrophyShelf.css';

interface TrophyShelfProps {
  state: Achievements | null;
}

/**
 * Pill in the TimeSeries panel head — now showing the user's current
 * "🔥 streak / ⚡ level / 🏆 lifetime" snapshot. Click opens a popover with
 * the full numbers.
 *
 * Data comes from the standalone FitAssistant.FitFeed service
 * (RabbitMQ consumer → in-process state machine). Pre-refactor this was a
 * dedicated <c>Trophy</c> collection written by an in-process worker; now
 * it's an achievement state object recomputed by AchievementEngine on every
 * incoming workout. The component name and CSS class stay so we don't churn
 * unrelated files. See ADR-0004.
 */
export const TrophyShelf: React.FC<TrophyShelfProps> = ({ state }) => {
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useClickOutside(open, [triggerRef, popRef], () => setOpen(false));

  const [anchorRight, setAnchorRight] = useState(false);
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const POP_W = 340;
    const ROOM  = 16;
    setAnchorRight(r.left + POP_W + ROOM >= window.innerWidth);
  }, [open]);

  const streak = state?.currentStreakDays ?? 0;
  const level  = state?.level ?? 1;

  return (
    <div className={`trophy-shelf ${anchorRight ? 'trophy-shelf--anchor-right' : ''}`}>
      <button
        ref={triggerRef}
        type="button"
        className="trophy-shelf__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        data-testid="trophy-shelf-trigger"
      >
        <span className="trophy-shelf__trigger-icon" aria-hidden="true">🔥</span>
        <span className="trophy-shelf__trigger-label">Streak</span>
        <span className="trophy-shelf__trigger-count">{streak}</span>
      </button>

      {open && (
        <div
          ref={popRef}
          className="trophy-shelf__panel"
          role="dialog"
          aria-label="Achievements"
          data-testid="trophy-shelf-panel"
        >
          <div className="trophy-shelf__panel-head">
            <span className="trophy-shelf__panel-title">Achievements</span>
            <FeatureBadge feature="queue-etl" />
          </div>

          {!state ? (
            <div className="trophy-shelf__empty">
              The FitFeed service hasn't reported any state yet. Log a workout
              and a friend will see it — your own streak and level update on
              the same event.
            </div>
          ) : (
            <ul className="trophy-shelf__list" role="list">
              <Row icon="🔥" title={`Current streak: ${state.currentStreakDays} day${state.currentStreakDays === 1 ? '' : 's'}`}
                   detail={`Longest streak so far: ${state.longestStreakDays}.`} />
              <Row icon="⚡" title={`Level ${level}`}
                   detail={`${state.lifetimeKcalBurned.toLocaleString()} kcal lifetime. Next level at ${((level) * 5000).toLocaleString()} kcal.`} />
              <Row icon="🏆" title={`${state.lifetimeWorkouts} workouts logged`}
                   detail="Milestones at 10, 25, 50, 100, then every 50." />
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

const Row: React.FC<{ icon: string; title: string; detail: string }> = ({ icon, title, detail }) => (
  <li>
    <div className="trophy-shelf__item">
      <span className="trophy-shelf__item-icon" aria-hidden="true">{icon}</span>
      <span className="trophy-shelf__item-text">
        <span className="trophy-shelf__item-title">{title}</span>
        <span className="trophy-shelf__item-detail">{detail}</span>
      </span>
    </div>
  </li>
);
