const express = require('express');
const Message = require('../models/Message');
const Room = require('../models/Room');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/room/:roomId', authMiddleware, async (req, res) => {
  try {
    const messages = await Message.find({ roomId: req.params.roomId })
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ messages: messages.reverse() });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;