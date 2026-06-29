const express = require('express');
const Room = require('../models/Room');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.post('/', authMiddleware, async (req, res) => {
  const { name, isPrivate } = req.body;
  try {
    const room = new Room({ name, isPrivate: isPrivate || false, creator: req.userId, members: [] });
    await room.save();
    res.status(201).json({ room });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const rooms = await Room.find()
      .populate('creator', 'name')
      .populate('members', 'name');
    res.json({ rooms });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate('creator', 'name')
      .populate('members', 'name');
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    res.json({ room });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:id/members', async (req, res) => {
  const { userId } = req.body;
  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (room.creator.toString() !== req.userId) {
      return res.status(403).json({ message: 'Only creator can manage members' });
    }

    if (!room.members.includes(userId)) {
      room.members.push(userId);
      await room.save();
    }
    res.json({ room });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id/members/:userId', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (room.creator.toString() !== req.userId) {
      return res.status(403).json({ message: 'Only creator can manage members' });
    }

    room.members = room.members.filter(m => m.toString() !== req.params.userId);
    await room.save();
    res.json({ room });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;