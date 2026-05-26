import React, { useEffect, useState } from 'react';

/** Fit fun-facts rotated while the parent agent delegates to a sub-agent and
 *  the sub-agent fetches + digests its query tools. None of them depend on
 *  the user's data — they're context-free filler so the dead time before
 *  the first streamed token feels intentional. */
const FUN_FACTS = [
  '🚴 Cycling at moderate pace burns ~300 kcal/hour',
  '❤️ Resting HR drops ~1bpm for every ~5 weeks of consistent cardio',
  '💪 Muscle protein synthesis peaks 24-48h after resistance training',
  '😴 Most aerobic adaptations happen during sleep, not during the workout',
  '🌡️ A 2% drop in hydration cuts endurance roughly 10%',
  '🏃 Easy-pace runs build mitochondria; sprints build neuromuscular drive',
  '🧂 Sweat sheds ~500–1000mg of sodium per liter — refuel accordingly',
  '🥦 25g+ of fibre per day correlates with lower resting cortisol',
  '🦵 Zone-2 cardio improves fat oxidation without trashing recovery',
  '🧠 Sleep deprivation cuts maximal strength output ~5% the next day',
];

/** Three-phase indicator shown while the parent's sub-agent delegation runs
 *  but before the first streamed token arrives. Mirrors GeneratingProgress on
 *  the Weekly Summary card. Phase 3 ("Composing response…") is implicit: as
 *  soon as a chunk arrives, Coach.tsx swaps this component out for the
 *  streaming MessageBubble. */
export const CoachThinking: React.FC = () => {
  const [phase, setPhase] = useState<1 | 2>(1);
  const [factIdx, setFactIdx] = useState(() => Math.floor(Math.random() * FUN_FACTS.length));

  useEffect(() => {
    const t = setTimeout(() => setPhase(2), 500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (phase !== 2) return;
    const t = setInterval(() => setFactIdx((i) => (i + 1) % FUN_FACTS.length), 1500);
    return () => clearInterval(t);
  }, [phase]);

  return (
    <div
      className="coach__bubble coach__bubble--assistant coach__thinking"
      role="status"
      aria-live="polite"
    >
      {phase === 1 ? (
        <div className="coach__thinking-row">
          <span className="coach__thinking-dots" aria-hidden="true">
            <span className="coach__thinking-dot" />
            <span className="coach__thinking-dot" />
            <span className="coach__thinking-dot" />
          </span>
          <span className="coach__thinking-label">Routing to Coach…</span>
        </div>
      ) : (
        <div className="coach__thinking-row">
          <span className="coach__thinking-spinner" aria-hidden="true" />
          <span className="coach__thinking-fact" key={factIdx}>{FUN_FACTS[factIdx]}</span>
        </div>
      )}
    </div>
  );
};
