// frontend/src/components/Chat.tsx

import React from 'react';
import './Chat.css';

interface ChatProps {
  chatLog: string[];
  chatInput: string;
  setChatInput: (input: string) => void;
  sendChatMessage: () => void;
}

const Chat: React.FC<ChatProps> = ({ chatLog, chatInput, setChatInput, sendChatMessage }) => {
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      sendChatMessage();
    }
  };

  return (
    <div className="chat">
      <div className="chat-log">
        {chatLog.map((msg, idx) => {
          let role: 'user' | 'assistant' | 'system' = 'assistant'; // Default to assistant
          let content = msg;

          if (msg.startsWith('You:')) {
            role = 'user';
            content = msg.substring(4).trim();
          } else if (msg.startsWith('GPT:')) {
            role = 'assistant';
            content = msg.substring(4).trim();
          }

          return (
            <div
              key={idx}
              className={`chat-message ${role}`}
            >
              {content}
            </div>
          );
        })}
      </div>
      <div className="chat-input">
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask GPT something..."
        />
        <button onClick={sendChatMessage}>Send</button>
      </div>
    </div>
  );
};

export default Chat;
