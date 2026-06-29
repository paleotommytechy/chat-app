import React from 'react';

export default function PresenceList({ users }) {
  return (
    <div className="w-48 bg-gray-50 h-full overflow-y-auto p-4">
      <h3 className="font-medium mb-2">Online ({users.length})</h3>
      <div className="space-y-1">
        {users.map(user => (
          <div key={user.id} className="text-sm">
            {user.name || 'Unknown'}
          </div>
        ))}
      </div>
    </div>
  );
}