import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import RoomList from '../components/RoomList';
import MessageList from '../components/MessageList';
import ChatInput from '../components/ChatInput';
import TypingIndicator from '../components/TypingIndicator';
import PresenceList from '../components/PresenceList';
import axios from 'axios';

export default function Chat() {
  const { user, token, logout } = useAuth();
  const socket = useSocket();
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    if (!token) return;
    axios.get('/api/rooms', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setRooms(res.data.rooms))
      .catch(console.error);
  }, [token]);

  useEffect(() => {
    if (!socket || !selectedRoom) return;

    socket.emit('join_room', { roomId: selectedRoom._id });

    socket.on('message_history', ({ messages: history }) => {
      setMessages(history);
    });

    socket.on('new_message', ({ roomId, message }) => {
      if (roomId === selectedRoom._id) {
        setMessages(prev => [...prev, message]);
      }
    });

    socket.on('typing_list', ({ roomId, users }) => {
      if (roomId === selectedRoom._id) {
        setTypingUsers(users);
      }
    });

    socket.on('online_list', ({ roomId, users }) => {
      if (roomId === selectedRoom._id) {
        setOnlineUsers(users);
      }
    });

    return () => {
      socket.off('message_history');
      socket.off('new_message');
      socket.off('typing_list');
      socket.off('online_list');
    };
  }, [socket, selectedRoom]);

  const handleSend = (text) => {
    if (socket && selectedRoom) {
      socket.emit('new_message', { roomId: selectedRoom._id, text });
    }
  };

  const handleTyping = (isTyping) => {
    if (socket && selectedRoom) {
      if (isTyping) {
        socket.emit('typing_start', { roomId: selectedRoom._id });
      } else {
        socket.emit('typing_stop', { roomId: selectedRoom._id });
      }
    }
  };

  const handleCreateRoom = async () => {
    const name = prompt('Room name:');
    const isPrivate = confirm('Private room?');
    if (name && token) {
      const res = await axios.post('/api/rooms', { name, isPrivate }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRooms(prev => [...prev, res.data.room]);
    }
  };

  return (
    <div className="flex h-screen">
      <div className="flex flex-col flex-1">
        <div className="flex justify-between items-center p-4 border-b">
          <h1 className="text-xl font-bold">Chat App</h1>
          <div className="flex items-center gap-4">
            <span>{user?.name}</span>
            <button onClick={logout} className="text-red-500 hover:underline">
              Logout
            </button>
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <RoomList 
            rooms={rooms} 
            selectedRoom={selectedRoom} 
            onSelectRoom={setSelectedRoom}
            onCreateRoom={handleCreateRoom}
          />
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b">
              <h2 className="font-bold">{selectedRoom?.name || 'Select a room'}</h2>
              <div className="text-sm text-gray-500">
                {selectedRoom?.isPrivate ? 'Private' : 'Public'} room
              </div>
            </div>
            <MessageList messages={messages} />
            <TypingIndicator users={typingUsers} />
            <ChatInput 
              onSend={handleSend} 
              onTyping={handleTyping} 
              roomId={selectedRoom?._id} 
            />
          </div>
        </div>
      </div>
      <PresenceList users={onlineUsers} />
    </div>
  );
}