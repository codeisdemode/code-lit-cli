// frontend/src/components/Chat.tsx
import React, { useRef, useEffect } from 'react';

interface ChatProps {
  chatLog: string[];
  chatInput: string;
  setChatInput: (input: string) => void;
  sendChatMessage: () => void;
}

const Chat: React.FC<ChatProps> = ({ chatLog, chatInput, setChatInput, sendChatMessage }) => {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog]);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  return (
    <div className="chat">
      <h2>Chat</h2>
      <div className="chat-log">
        {chatLog.map((msg, index) => (
          <div key={index} className="chat-message">
            {msg}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <div className="chat-input">
        <textarea
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message here..."
        />
        <button onClick={sendChatMessage}>Send</button>
      </div>
    </div>
  );
};

export default Chat;
