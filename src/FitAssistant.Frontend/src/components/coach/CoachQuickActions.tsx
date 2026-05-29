import React from 'react';

interface CoachQuickActionsProps {
  onMotivate: () => void;
  onAnalyzePhoto: () => void;
  onLogWorkout: () => void;
  disabled?: boolean;
  motivateLocked?: boolean;
}

export const CoachQuickActions: React.FC<CoachQuickActionsProps> = ({
  onMotivate,
  onAnalyzePhoto,
  onLogWorkout,
  disabled,
  motivateLocked,
}) => {
  return (
    <div className="coach__quick">
      <p className="coach__quick-prompt">How can I help today?</p>
      <div className="coach__quick-grid">
        <button
          type="button"
          className="coach__quick-chip"
          onClick={onMotivate}
          disabled={disabled || motivateLocked}
          title={motivateLocked ? 'Fit Assistant Ultra only — upgrade in the persona switcher' : undefined}
          data-testid="quick-action-motivate"
        >
          <span className="coach__quick-icon" style={{ color: 'var(--ring-yellow)' }} aria-hidden="true">⚡</span>
          <span className="coach__quick-text">
            <span className="coach__quick-name">Motivate me {motivateLocked && <span className="coach__quick-ultra">✦ Ultra</span>}</span>
            <span className="coach__quick-desc">Personalized pep talk based on your week</span>
          </span>
        </button>
        <button
          type="button"
          className="coach__quick-chip"
          onClick={onAnalyzePhoto}
          disabled={disabled}
          data-testid="quick-action-photo"
        >
          <span className="coach__quick-icon" style={{ color: 'var(--ring-purple)' }} aria-hidden="true">📸</span>
          <span className="coach__quick-text">
            <span className="coach__quick-name">Analyze a photo</span>
            <span className="coach__quick-desc">Snap food, get calories logged</span>
          </span>
        </button>
        <button
          type="button"
          className="coach__quick-chip"
          onClick={onLogWorkout}
          disabled={disabled}
          data-testid="quick-action-workout"
        >
          <span className="coach__quick-icon" style={{ color: 'var(--ring-red)' }} aria-hidden="true">🏃</span>
          <span className="coach__quick-text">
            <span className="coach__quick-name">Log a workout</span>
            <span className="coach__quick-desc">Tell me what you did, I'll record it</span>
          </span>
        </button>
      </div>
    </div>
  );
};
