// frontend/src/components/Notification.tsx
import React from 'react';

interface NotificationProps {
  message: string;
  type: 'success' | 'error';
  onClose?: () => void;
}

const Notification: React.FC<NotificationProps> = ({ message, type, onClose }) => {
  return (
    <div className={`notification ${type}`}>
      <span>{message}</span>
      {onClose && <button onClick={onClose}>X</button>}
    </div>
  );
};

export default Notification;
