import React, { useState, useEffect, useRef } from 'react';

export default function ChatInput({ onSend, onTyping, roomId }) {
  const [text, setText] = useState('');
  const typingTimeoutRef = useRef();

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text);
    setText('');
    onTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleChange = (e) => {
    setText(e.target.value);
    if (!typingTimeoutRef.current) {
      onTyping(true);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
      typingTimeoutRef.current = null;
    }, 2000);
  };

  return (
    <div className="p-4 border-t flex gap-2">
      <input
        value={text}
        onChange={handleChange}
        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
        placeholder="Type a message..."
        className="flex-1 border rounded px-3 py-2"
      />
      <button onClick={handleSend} className="bg-blue-500 text-white px-4 rounded hover:bg-blue-600">
        Send
      </button>
    </div>
  );
}