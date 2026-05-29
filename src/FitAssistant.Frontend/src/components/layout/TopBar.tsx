import React from 'react';
import { UserPill, UserSummary } from './UserPill';
import './TopBar.css';

interface TopBarProps {
  users: UserSummary[];
  selectedUserId: string | null;
  onSelectUser: (id: string) => void;
  onUserCreated: (user: UserSummary) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  users,
  selectedUserId,
  onSelectUser,
  onUserCreated,
}) => {
  return (
    <header className="topbar">
      <div className="topbar__inner">
        <div className="topbar__brand">
          <div className="topbar__logo" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path
                d="M9 2.5C5 2.5 2.5 5.5 2.5 9c0 4 4 6.5 6.5 6.5s6.5-2.5 6.5-6.5c0-3.5-2.5-6.5-6.5-6.5z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path
                d="M5.5 9.5l2 2L12.5 6.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="topbar__title">Fit Assistant</span>
        </div>

        <div className="topbar__actions">
          {users.length > 0 && (
            <UserPill
              users={users}
              selectedUserId={selectedUserId}
              onSelectUser={onSelectUser}
              onUserCreated={onUserCreated}
            />
          )}
        </div>
      </div>
    </header>
  );
};
