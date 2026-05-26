import React from 'react';
import { Card } from '../common/Card';
import { Skeleton } from '../common/Skeleton';
import './KpiTile.css';

export type KpiTone = 'red' | 'green' | 'blue' | 'purple' | 'yellow' | 'orange';

interface KpiTileProps {
  testId?: string;
  tone: KpiTone;
  label: string;
  icon?: React.ReactNode;
  value?: string | number;
  unit?: string;
  hint?: React.ReactNode;
  visual?: React.ReactNode;
  loading?: boolean;
  /** Slot for an end-of-card feature badge (Phase 6). */
  badge?: React.ReactNode;
}

export const KpiTile: React.FC<KpiTileProps> = ({
  testId,
  tone,
  label,
  icon,
  value,
  unit,
  hint,
  visual,
  loading = false,
  badge,
}) => {
  return (
    <Card testId={testId} className={`kpi-tile kpi-tile--${tone}`} padding="md">
      <div className="kpi-tile__head">
        <div className="kpi-tile__label">
          {icon && <span className="kpi-tile__icon" aria-hidden="true">{icon}</span>}
          <span>{label}</span>
        </div>
        {badge && <div className="kpi-tile__badge">{badge}</div>}
      </div>

      <div className="kpi-tile__body">
        <div className="kpi-tile__valueArea">
          {loading ? (
            <>
              <Skeleton width="80%" height="36px" />
              <div style={{ height: 6 }} />
              <Skeleton width="60%" height="14px" />
            </>
          ) : (
            <>
              <div className="kpi-tile__value">
                <span className="kpi-tile__num">{value ?? '—'}</span>
                {unit && <span className="kpi-tile__unit">{unit}</span>}
              </div>
              {hint && <div className="kpi-tile__hint">{hint}</div>}
            </>
          )}
        </div>
        <div className="kpi-tile__visual">
          {loading ? <Skeleton width="64px" height="64px" radius={64} /> : visual}
        </div>
      </div>
    </Card>
  );
};
