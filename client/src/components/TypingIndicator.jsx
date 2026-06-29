import React from 'react';

export default function TypingIndicator({ users }) {
  if (users.length === 0) return null;

  return (
    <div className="px-4 py-2 text-sm text-gray-500 italic">
      {users.map(u => u.name).join(', ')} {users.length === 1 ? 'is' : 'are'} typing...
    </div>
  );
}