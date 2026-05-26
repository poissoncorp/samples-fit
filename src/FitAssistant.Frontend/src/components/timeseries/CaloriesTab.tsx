import React, { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { useApi } from '../../hooks/useApi';
import { getCalories, getUser, simulateCalorieIntake } from '../../api';
import { Button } from '../common/Button';
import { Skeleton } from '../common/Skeleton';
import { useToast } from '../../hooks/useToast';
import { Range } from './RangeChips';
import { ChartTooltip } from './ChartTooltip';
import { ChartEmpty, ChartError } from './HeartRateTab';

interface CaloriesTabProps {
  userId: string;
  range: Range;
  refreshKey: number;
  onLocalRefresh: () => void;
}

const KCAL_FALLBACK_GOAL = 2200;

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
}

export const CaloriesTab: React.FC<CaloriesTabProps> = ({ userId, range, refreshKey, onLocalRefresh }) => {
  const cal = useApi(() => getCalories(userId, range), [userId, range, refreshKey]);
  const user = useApi(() => getUser(userId), [userId, refreshKey]);
  const toast = useToast();

  const goal = (user.data?.dailyCalorieGoal as number | undefined) ?? KCAL_FALLBACK_GOAL;

  const chartData = useMemo(() => {
    if (!cal.data) return [];
    const intakeMap = new Map(cal.data.intake.map((d) => [d.date.slice(0, 10), d.total]));
    const burnedMap = new Map(cal.data.burned.map((d) => [d.date.slice(0, 10), d.total]));
    const allDates = Array.from(
      new Set([...Array.from(intakeMap.keys()), ...Array.from(burnedMap.keys())])
    ).sort();
    return allDates.map((date) => ({
      date,
      label: fmtDate(date),
      intake: intakeMap.get(date) ?? 0,
      burned: burnedMap.get(date) ?? 0,
    }));
  }, [cal.data]);

  const totals = useMemo(() => {
    if (chartData.length === 0) return null;
    const intakeSum = chartData.reduce((s, d) => s + d.intake, 0);
    const burnedSum = chartData.reduce((s, d) => s + d.burned, 0);
    return {
      avgIntake: Math.round(intakeSum / chartData.length),
      totalBurned: burnedSum,
    };
  }, [chartData]);

  const handleAddMeal = async () => {
    try {
      const r = await simulateCalorieIntake(userId, 0.5);
      toast.show({ tone: 'success', kind: 'meal', message: r.message });
      cal.reload();
      onLocalRefresh();
    } catch {
      toast.show({ tone: 'error', kind: 'meal', message: 'Could not log meal' });
    }
  };

  const loading = cal.loading || user.loading;

  return (
    <div className="ts-tab">
      <div className="ts-tab__head">
        <div className="ts-tab__stats">
          {totals ? (
            <>
              <Stat label="Avg intake" value={`${totals.avgIntake.toLocaleString('en-US')}`} unit="cal" />
              <Stat label="Total burned" value={totals.totalBurned.toLocaleString('en-US')} unit="cal" />
              <Stat label="Daily goal" value={goal.toLocaleString('en-US')} unit="cal" muted />
            </>
          ) : loading ? (
            <Skeleton width="220px" height="14px" />
          ) : null}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleAddMeal}
          testId="cal-add-meal"
          iconLeft={<span aria-hidden="true">🥗</span>}
        >
          Log a meal
        </Button>
      </div>

      <div className="ts-tab__chart">
        {loading && !cal.data ? (
          <Skeleton width="100%" height="240px" radius={16} />
        ) : cal.error ? (
          <ChartError onRetry={cal.reload} />
        ) : chartData.length === 0 ? (
          <ChartEmpty hint="No calorie data yet — log a meal above." />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -16 }} barCategoryGap="20%">
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'var(--text-mute)' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={20}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--text-mute)' }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip content={<ChartTooltip unit="cal" />} cursor={{ fill: 'var(--bg-sunken)', opacity: 0.5 }} />
              <ReferenceLine
                y={goal}
                stroke="var(--text-mute)"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
              />
              <Bar dataKey="intake" name="Intake" fill="var(--ring-blue)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="burned" name="Burned" fill="var(--ring-green)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="ts-tab__caption">
        <span className="ts-tab__legend"><span style={{ background: 'var(--ring-blue)' }} />Intake</span>
        <span className="ts-tab__legend"><span style={{ background: 'var(--ring-green)' }} />Burned</span>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; unit?: string; muted?: boolean }> = ({
  label,
  value,
  unit,
  muted,
}) => (
  <div className={`ts-tab__stat ${muted ? 'is-muted' : ''}`}>
    <span className="ts-tab__stat-label">{label}</span>
    <span className="ts-tab__stat-value">
      {value}
      {unit && <span className="ts-tab__stat-unit"> {unit}</span>}
    </span>
  </div>
);
