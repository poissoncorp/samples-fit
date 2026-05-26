import React from 'react';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface CoachMessage {
  id: string;
  role: MessageRole;
  content: string;
  attachmentName?: string;
  streaming?: boolean;
}

interface MessageBubbleProps {
  message: CoachMessage;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  if (message.role === 'system') {
    return <div className="coach__system">{message.content}</div>;
  }
  return (
    <div className={`coach__bubble coach__bubble--${message.role}`}>
      {message.attachmentName && message.role === 'user' && (
        <div className="coach__attachment">
          <span aria-hidden="true">📎</span>
          {message.attachmentName}
        </div>
      )}
      <div className="coach__content">
        {message.content}
        {message.streaming && <span className="coach__cursor" aria-hidden="true" />}
      </div>
    </div>
  );
};
