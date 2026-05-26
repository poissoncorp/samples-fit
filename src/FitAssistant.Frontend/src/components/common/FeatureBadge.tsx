import React from 'react';
import { Popover } from './Popover';
import { FEATURES, FeatureKey } from './featureCatalog';
import './FeatureBadge.css';

export type { FeatureKey } from './featureCatalog';

interface FeatureBadgeProps {
  feature: FeatureKey;
  size?: 'xs' | 'sm';
  label?: string;
}

export const FeatureBadge: React.FC<FeatureBadgeProps> = ({ feature, size = 'xs', label }) => {
  const meta = FEATURES[feature];
  return (
    <Popover
      title={meta.title}
      align="right"
      hoverable
      trigger={({ ref, onClick, onMouseEnter, onMouseLeave, onFocus, onBlur, ...aria }) => (
        <button
          ref={ref as React.RefObject<HTMLButtonElement>}
          type="button"
          className={`feature-badge feature-badge--${size}`}
          data-testid={`feature-badge-${feature}`}
          onClick={onClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onFocus={onFocus}
          onBlur={onBlur}
          {...aria}
        >
          <span className="feature-badge__star" aria-hidden="true">✦</span>
          {label ?? meta.label}
        </button>
      )}
    >
      <p className="feature-badge-popover__intro">{meta.description}</p>
      <ul className="feature-badge-popover__challenges" aria-label="Challenges solved">
        {meta.challenges.map((c) => (
          <li key={c.title} className="feature-badge-popover__challenge">
            <span
              className={`feature-badge-popover__icon feature-badge-popover__icon--${c.tone}`}
              aria-hidden="true"
            >
              {c.icon}
            </span>
            <span className="feature-badge-popover__text">
              <span className="feature-badge-popover__challenge-title">{c.title}</span>
              <span className="feature-badge-popover__challenge-detail">{c.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      <a href={meta.docsUrl} target="_blank" rel="noreferrer">
        Read the docs ↗
      </a>
    </Popover>
  );
};
