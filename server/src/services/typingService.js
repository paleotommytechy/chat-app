const constants = require('../utils/constants');

const typingService = {
  typingUsers: new Map(),
  debounceTimers: new Map(),

  startTyping(io, roomId, userId, userName) {
    if (this.debounceTimers.has(`${roomId}:${userId}`)) {
      clearTimeout(this.debounceTimers.get(`${roomId}:${userId}`));
    }

    this.debounceTimers.set(`${roomId}:${userId}`, setTimeout(() => {
      if (!this.typingUsers.has(roomId)) {
        this.typingUsers.set(roomId, new Set());
      }
      this.typingUsers.get(roomId).add(JSON.stringify({ id: userId, name: userName }));
      
      io.to(roomId).emit('typing_list', {
        roomId,
        users: Array.from(this.typingUsers.get(roomId)).map(JSON.parse)
      });
    }, constants.TYPING_DEBOUNCE_MS));
  },

  stopTyping(io, roomId, userId) {
    const key = `${roomId}:${userId}`;
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key));
      this.debounceTimers.delete(key);
    }

    if (this.typingUsers.has(roomId)) {
      const users = this.typingUsers.get(roomId);
      const userToRemove = Array.from(users).find(u => JSON.parse(u).id === userId);
      if (userToRemove) {
        users.delete(userToRemove);
        io.to(roomId).emit('typing_list', {
          roomId,
          users: Array.from(users).map(JSON.parse)
        });
      }
    }
  },

  clearRoom(roomId) {
    if (this.typingUsers.has(roomId)) {
      this.typingUsers.delete(roomId);
    }
  }
};

module.exports = typingService;