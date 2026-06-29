import React, { useEffect, useRef } from 'react';

export default function MessageList({ messages }) {
  const bottomRef = useRef();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      {messages.map(msg => (
        <div key={msg._id} className="bg-white p-3 rounded shadow-sm">
          <span className="font-medium">{msg.userId?.name}:</span> {msg.text}
          <div className="text-xs text-gray-400 mt-1">
            {new Date(msg.createdAt).toLocaleTimeString()}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}