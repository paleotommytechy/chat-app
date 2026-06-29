const jwt = require('jsonwebtoken');
const config = require('../config');
const Room = require('../models/Room');
const Message = require('../models/Message');
const typingService = require('../services/typingService');

module.exports = (io) => {
  const onlineUsers = new Map();

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      socket.userId = decoded.userId;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join_room', async ({ roomId }) => {
      try {
        const room = await Room.findById(roomId);
        if (!room) {
          return socket.emit('room_error', { message: 'Room not found' });
        }

        if (room.isPrivate && !room.members.includes(socket.userId) && room.creator.toString() !== socket.userId) {
          return socket.emit('room_error', { message: 'Access denied to private room' });
        }

        socket.join(roomId);

        if (!onlineUsers.has(roomId)) {
          onlineUsers.set(roomId, new Set());
        }
        onlineUsers.get(roomId).add(JSON.stringify({ id: socket.userId, name: socket.data.userName || '' }));
        io.to(roomId).emit('online_list', {
          roomId,
          users: Array.from(onlineUsers.get(roomId)).map(JSON.parse)
        });

        const messages = await Message.find({ roomId })
          .populate('userId', 'name')
          .sort({ createdAt: -1 })
          .limit(50);
        socket.emit('message_history', {
          roomId,
          messages: messages.reverse()
        });
      } catch (error) {
        socket.emit('room_error', { message: 'Server error' });
      }
    });

    socket.on('leave_room', ({ roomId }) => {
      socket.leave(roomId);
      
      if (onlineUsers.has(roomId)) {
        const users = onlineUsers.get(roomId);
        const userToRemove = Array.from(users).find(u => JSON.parse(u).id === socket.userId);
        if (userToRemove) {
          users.delete(userToRemove);
          io.to(roomId).emit('online_list', {
            roomId,
            users: Array.from(users).map(JSON.parse)
          });
        }
        
        if (users.size === 0) {
          onlineUsers.delete(roomId);
          typingService.clearRoom(roomId);
        }
      }
    });

    socket.on('new_message', async ({ roomId, text }) => {
      try {
        const room = await Room.findById(roomId);
        if (!room) {
          return socket.emit('room_error', { message: 'Room not found' });
        }

        if (room.isPrivate && !room.members.includes(socket.userId) && room.creator.toString() !== socket.userId) {
          return socket.emit('room_error', { message: 'Access denied' });
        }

        const message = new Message({ roomId, userId: socket.userId, text });
        await message.save();

        const populatedMessage = await Message.findById(message._id).populate('userId', 'name');

        io.to(roomId).emit('new_message', {
          roomId,
          message: {
            _id: populatedMessage._id,
            text: populatedMessage.text,
            userId: populatedMessage.userId,
            createdAt: populatedMessage.createdAt
          }
        });

        typingService.stopTyping(io, roomId, socket.userId);
      } catch (error) {
        socket.emit('room_error', { message: 'Server error' });
      }
    });

    socket.on('typing_start', async ({ roomId }) => {
      try {
        const room = await Room.findById(roomId);
        if (!room) return;

        const User = require('../models/User');
        const user = await User.findById(socket.userId);
        if (user) {
          typingService.startTyping(io, roomId, socket.userId, user.name);
        }
      } catch (error) {
        // silent fail
      }
    });

    socket.on('typing_stop', ({ roomId }) => {
      typingService.stopTyping(io, roomId, socket.userId);
    });

    socket.on('disconnect', () => {
      onlineUsers.forEach((users, roomId) => {
        const userToRemove = Array.from(users).find(u => JSON.parse(u).id === socket.userId);
        if (userToRemove) {
          users.delete(userToRemove);
          io.to(roomId).emit('online_list', {
            roomId,
            users: Array.from(users).map(JSON.parse)
          });
        }
        
        if (users.size === 0) {
          onlineUsers.delete(roomId);
          typingService.clearRoom(roomId);
        }
      });
    });
  });
};