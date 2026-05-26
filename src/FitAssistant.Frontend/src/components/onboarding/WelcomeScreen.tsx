import React, { useState } from 'react';
import { seedAll, getUsers } from '../../api';
import { Button } from '../common/Button';
import { useToast } from '../../hooks/useToast';
import { UserSummary } from '../layout/UserPill';
import './WelcomeScreen.css';

interface WelcomeScreenProps {
  onUsersReady: (users: UserSummary[]) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onUsersReady }) => {
  const [seeding, setSeeding] = useState(false);
  const toast = useToast();

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedAll();
      const users = await getUsers();
      toast.show({ tone: 'success', message: 'Sample data seeded' });
      onUsersReady(users);
    } catch (e) {
      toast.show({
        tone: 'error',
        message: 'Seed failed — is the backend running?',
        action: { label: 'Retry', onClick: handleSeed },
      });
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="welcome">
      <div className="welcome__inner">
        <div className="welcome__rings" aria-hidden="true">
          <svg viewBox="0 0 200 200" width="160" height="160">
            <defs>
              <linearGradient id="ringRed" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--ring-red)" />
                <stop offset="100%" stopColor="#ff7a8f" />
              </linearGradient>
              <linearGradient id="ringGreen" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--ring-green)" />
                <stop offset="100%" stopColor="#cdf78b" />
              </linearGradient>
              <linearGradient id="ringBlue" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--ring-blue)" />
                <stop offset="100%" stopColor="#5ee9e3" />
              </linearGradient>
            </defs>
            {[
              { r: 80, color: 'url(#ringRed)', dash: 0.78 },
              { r: 60, color: 'url(#ringGreen)', dash: 0.62 },
              { r: 40, color: 'url(#ringBlue)', dash: 0.9 },
            ].map((ring, i) => {
              const c = 2 * Math.PI * ring.r;
              return (
                <g key={i} transform="translate(100 100) rotate(-90)">
                  <circle
                    cx="0"
                    cy="0"
                    r={ring.r}
                    fill="none"
                    stroke="var(--bg-sunken)"
                    strokeWidth="14"
                  />
                  <circle
                    cx="0"
                    cy="0"
                    r={ring.r}
                    fill="none"
                    stroke={ring.color}
                    strokeWidth="14"
                    strokeLinecap="round"
                    strokeDasharray={`${c * ring.dash} ${c}`}
                  />
                </g>
              );
            })}
          </svg>
        </div>

        <h1 className="welcome__title">Welcome to Fit Assistant</h1>
        <p className="welcome__lead">
          A RavenDB sample app that puts AI Agents, Time Series, and GenAI in one
          place — track workouts, analyze food photos, and chat with a coach grounded
          in your own data.
        </p>

        <div className="welcome__actions">
          <Button
            variant="primary"
            size="lg"
            loading={seeding}
            onClick={handleSeed}
            testId="welcome-seed"
          >
            Seed sample data
          </Button>
        </div>

        <ul className="welcome__features">
          <li><span style={{ background: 'var(--ring-red)' }} />AI Agent chat</li>
          <li><span style={{ background: 'var(--ring-green)' }} />Time-series rollups</li>
          <li><span style={{ background: 'var(--ring-blue)' }} />GenAI summaries</li>
          <li><span style={{ background: 'var(--ring-purple)' }} />Photo calorie analysis</li>
        </ul>
      </div>
    </div>
  );
};
