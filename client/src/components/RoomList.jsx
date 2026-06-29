import React from 'react';

export default function RoomList({ rooms, selectedRoom, onSelectRoom, onCreateRoom }) {
  return (
    <div className="w-64 bg-gray-100 h-full flex flex-col">
      <div className="p-4 border-b">
        <button 
          onClick={onCreateRoom}
          className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
        >
          Create Room
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {rooms.map(room => (
          <div
            key={room._id}
            onClick={() => onSelectRoom(room)}
            className={`p-4 cursor-pointer hover:bg-gray-200 border-b ${selectedRoom?._id === room._id ? 'bg-blue-100' : ''}`}
          >
            <div className="font-medium">{room.name}</div>
            <div className="text-xs text-gray-500">
              {room.isPrivate ? 'Private' : 'Public'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}