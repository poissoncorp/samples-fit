import React, { useEffect, useRef, useState } from 'react';
import { generateUser, getFitnessGoals } from '../../api';
import { Button } from '../common/Button';
import { useClickOutside } from '../../hooks/useClickOutside';
import './UserPill.css';

export interface UserSummary {
  id: string;
  name: string;
  fitnessGoal: string;
  isPremium: boolean;
}

interface UserPillProps {
  users: UserSummary[];
  selectedUserId: string | null;
  onSelectUser: (id: string) => void;
  onUserCreated: (user: UserSummary) => void;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase();
}

// Stable hue per user id for the avatar gradient.
function hueFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

export const UserPill: React.FC<UserPillProps> = ({
  users,
  selectedUserId,
  onSelectUser,
  onUserCreated,
}) => {
  const [open, setOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [goals, setGoals] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [newAsUltra, setNewAsUltra] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const current = users.find((u) => u.id === selectedUserId) ?? users[0];

  useClickOutside(open, [triggerRef, popRef], () => setOpen(false));

  useEffect(() => {
    if (showNew && goals.length === 0) {
      getFitnessGoals().then(setGoals).catch(() => setGoals([]));
    }
  }, [showNew, goals.length]);

  const handleGenerate = async (goal: string) => {
    setCreating(true);
    try {
      const user = await generateUser(goal, newAsUltra);
      onUserCreated(user);
      onSelectUser(user.id);
      setShowNew(false);
      setNewAsUltra(false);
      setOpen(false);
    } finally {
      setCreating(false);
    }
  };

  if (!current) return null;

  return (
    <div className="user-pill-host">
      <button
        ref={triggerRef}
        type="button"
        className="user-pill"
        data-testid="user-pill"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span
          className="user-pill__avatar"
          style={{
            background: `linear-gradient(135deg, hsl(${hueFor(current.id)} 70% 60%), hsl(${(hueFor(current.id) + 40) % 360} 70% 50%))`,
          }}
          aria-hidden="true"
        >
          {initials(current.name)}
        </span>
        <span className="user-pill__name">{current.name}</span>
        {current.isPremium && (
          <span
            className="user-pill__ultra"
            data-testid="user-pill-ultra"
            aria-label="Fit Assistant Ultra"
            title="Fit Assistant Ultra — weekly summary & Motivate Me unlocked"
          >
            <span className="user-pill__ultra-spark" aria-hidden="true">✦</span>
            ULTRA
          </span>
        )}
        <svg className="user-pill__chev" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </button>

      {open && (
        <div className="user-pill__menu" ref={popRef} role="menu" aria-label="Switch user">
          {!showNew ? (
            <>
              <div className="user-pill__menu-label">Demo personas</div>
              <ul className="user-pill__list">
                {users.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={u.id === selectedUserId}
                      className={`user-pill__item ${u.id === selectedUserId ? 'is-selected' : ''}`}
                      onClick={() => {
                        onSelectUser(u.id);
                        setOpen(false);
                      }}
                    >
                      <span
                        className="user-pill__item-avatar"
                        style={{
                          background: `linear-gradient(135deg, hsl(${hueFor(u.id)} 70% 60%), hsl(${(hueFor(u.id) + 40) % 360} 70% 50%))`,
                        }}
                      >
                        {initials(u.name)}
                      </span>
                      <span className="user-pill__item-text">
                        <span className="user-pill__item-name">
                          {u.name}
                          {u.isPremium && (
                            <span
                              className="user-pill__ultra user-pill__ultra--inline"
                              aria-label="Fit Assistant Ultra"
                              title="Ultra"
                            >
                              <span className="user-pill__ultra-spark" aria-hidden="true">✦</span>
                              ULTRA
                            </span>
                          )}
                        </span>
                        <span className="user-pill__item-goal">{u.fitnessGoal}</span>
                      </span>
                      {u.id === selectedUserId && (
                        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                          <path d="M3 7L6 10L11 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="user-pill__divider" />
              <button
                type="button"
                role="menuitem"
                className="user-pill__item user-pill__item--ghost"
                onClick={() => setShowNew(true)}
                data-testid="user-pill-new"
              >
                <span className="user-pill__plus" aria-hidden="true">+</span>
                <span>New persona…</span>
              </button>
            </>
          ) : (
            <div className="user-pill__new">
              <div className="user-pill__menu-label">Pick a fitness goal</div>
              <div className="user-pill__goals">
                {goals.length === 0 ? (
                  <span className="user-pill__loading">Loading…</span>
                ) : (
                  goals.map((g) => (
                    <button
                      key={g}
                      type="button"
                      className="user-pill__goal"
                      disabled={creating}
                      onClick={() => handleGenerate(g)}
                    >
                      {g}
                    </button>
                  ))
                )}
              </div>
              <label className="user-pill__ultra-toggle" data-testid="user-pill-ultra-toggle">
                <input
                  type="checkbox"
                  checked={newAsUltra}
                  onChange={(e) => setNewAsUltra(e.target.checked)}
                  disabled={creating}
                />
                <span className="user-pill__ultra-toggle-text">
                  <span className="user-pill__ultra-toggle-name">
                    <span aria-hidden="true">✦</span> Fit Assistant Ultra
                  </span>
                  <span className="user-pill__ultra-toggle-desc">
                    Unlocks the GenAI weekly summary &amp; Motivate Me. Free tier still gets chat and photo logging.
                  </span>
                </span>
              </label>
              <div className="user-pill__new-foot">
                <Button variant="ghost" size="sm" onClick={() => { setShowNew(false); setNewAsUltra(false); }} disabled={creating}>
                  Back
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
