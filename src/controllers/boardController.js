const Board = require('../models/Board');
const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');

const createBoard = async (req, res, next) => {
  try {
    const { title, description } = req.body;
    const board = await Board.create({
      title,
      description,
      owner: req.user.id,
      members: []
    });

    await ActivityLog.create({
      boardId: board._id,
      userId: req.user.id,
      action: 'MEMBER_JOINED',
      details: { message: 'Board created' }
    });

    res.status(201).json({ success: true, board });
  } catch (err) { next(err); }
};

const getBoards = async (req, res, next) => {
  try {
    // Return boards where user is owner OR a member
    const boards = await Board.find({
      $or: [
        { owner: req.user.id },
        { members: req.user.id }
      ]
    }).populate('owner', 'name email').sort({ updatedAt: -1 });

    res.json({ success: true, boards });
  } catch (err) { next(err); }
};

const getBoardById = async (req, res, next) => {
  try {
    const board = await Board.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('members', 'name email');

    if (!board) {
      const err = new Error('Board not found');
      err.statusCode = 404;
      return next(err);
    }

    // Check access
    const isOwner = board.owner._id.toString() === req.user.id;
    const isMember = board.members.some(m => m._id.toString() === req.user.id);
    if (!isOwner && !isMember) {
      const err = new Error('Access denied');
      err.statusCode = 403;
      return next(err);
    }

    res.json({ success: true, board });
  } catch (err) { next(err); }
};

const inviteMember = async (req, res, next) => {
  try {
    const { email } = req.body;
    const board = await Board.findById(req.params.id);
    if (!board) return res.status(404).json({ success: false, message: 'Board not found' });
    
    if (board.owner.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only owners can invite members' });
    }

    const userToInvite = await User.findOne({ email });
    if (!userToInvite) return res.status(404).json({ success: false, message: 'User not found' });

    if (board.members.includes(userToInvite._id) || board.owner.toString() === userToInvite._id.toString()) {
      return res.status(400).json({ success: false, message: 'User is already a member' });
    }

    board.members.push(userToInvite._id);
    await board.save();

    await ActivityLog.create({
      boardId: board._id,
      userId: req.user.id,
      action: 'MEMBER_JOINED',
      details: { invitedUser: userToInvite.name }
    });

    res.json({ success: true, message: 'Member added successfully' });
  } catch (err) { next(err); }
};

module.exports = { createBoard, getBoards, getBoardById, inviteMember };
