const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { JWT_ACCESS_SECRET, CLIENT_ORIGIN } = require('../config/env');
const Board = require('../models/Board');

let io;

const initSockets = (server) => {
  io = new Server(server, {
    cors: {
      origin: CLIENT_ORIGIN,
      credentials: true,
    }
  });

  // ─── Socket Middleware: Authentication + Authorization ──────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, JWT_ACCESS_SECRET);
      socket.data.user = { id: decoded.sub, email: decoded.email };
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.data.user.id}`);

    // Join board-specific room
    socket.on('joinBoard', async (boardId) => {
      try {
        const board = await Board.findById(boardId);
        if (!board) return socket.emit('error', 'Board not found');

        // Check membership
        const isOwner = board.owner.toString() === socket.data.user.id;
        const isMember = board.members.some(m => m.toString() === socket.data.user.id);

        if (!isOwner && !isMember) {
          return socket.emit('error', 'Not a member of this board');
        }

        socket.join(`board:${boardId}`);
        console.log(`User ${socket.data.user.id} joined board: ${boardId}`);
      } catch (err) {
        socket.emit('error', 'Failed to join board');
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.data.user.id}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};

module.exports = { initSockets, getIO };
