// frontend/src/components/Notification.tsx

import React from 'react';
import './Notification.css';

interface NotificationProps {
  message: string;
  type: 'error' | 'success';
}

const Notification: React.FC<NotificationProps> = ({ message, type }) => {
  return <div className={`notification ${type}`}>{message}</div>;
};

export default Notification;
