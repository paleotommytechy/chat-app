const Room = require('../models/Room');

const roomAccessMiddleware = async (req, res, next) => {
  const { roomId } = req.params;
  const userId = req.userId;

  try {
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (room.isPrivate && !room.members.includes(userId) && room.creator.toString() !== userId) {
      return res.status(403).json({ message: 'Access denied to private room' });
    }

    req.room = room;
    next();
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = roomAccessMiddleware;