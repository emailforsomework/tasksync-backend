const Task = require('../models/Task');
const Board = require('../models/Board');
const ActivityLog = require('../models/ActivityLog');
const taskService = require('../services/taskService');
const { getIO } = require('../sockets');

const createTask = async (req, res, next) => {
  try {
    const { boardId, title, description, status } = req.body;
    
    const board = await Board.findById(boardId);
    if (!board) return res.status(404).json({ success: false, message: 'Board not found' });

    const position = await taskService.getNextPosition(boardId, status || 'TODO');

    const task = await Task.create({
      boardId,
      title,
      description,
      status: status || 'TODO',
      position
    });

    await ActivityLog.create({
      boardId,
      userId: req.user.id,
      action: 'CREATE_TASK',
      details: { taskTitle: title }
    });

    // Broadcast to board room
    getIO().to(`board:${boardId}`).emit('task:created', task);

    res.status(201).json({ success: true, task });
  } catch (err) { next(err); }
};

const getTasksByBoard = async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const tasks = await Task.find({ boardId }).sort({ position: 1 });
    res.json({ success: true, tasks });
  } catch (err) { next(err); }
};

const moveTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { destinationStatus, newPosition } = req.body;

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    const boardId = task.boardId.toString();
    const sourceStatus = task.status;

    // Atomic reindexing on server
    await taskService.reorderTasks(boardId, {
      taskId: id,
      sourceStatus,
      destStatus: destinationStatus,
      newPosition
    });

    await ActivityLog.create({
      boardId,
      userId: req.user.id,
      action: 'MOVE_TASK',
      details: { taskId: id, from: sourceStatus, to: destinationStatus }
    });

    // Broadcast update to all members in the board room
    // The frontend will listen and invalidate its React Query cache
    getIO().to(`board:${boardId}`).emit('task:moved', { taskId: id, boardId });

    res.json({ success: true, message: 'Task moved successfully' });
  } catch (err) { next(err); }
};

const deleteTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    const boardId = task.boardId.toString();
    await Task.findByIdAndDelete(id);

    // Re-index remaining tasks in the column to keep positions sequential
    const remaining = await Task.find({ boardId, status: task.status }).sort({ position: 1 });
    const bulkOps = remaining.map((t, idx) => ({
      updateOne: {
        filter: { _id: t._id },
        update: { position: idx }
      }
    }));
    if (bulkOps.length > 0) await Task.bulkWrite(bulkOps);

    getIO().to(`board:${boardId}`).emit('task:deleted', { taskId: id, boardId });

    res.json({ success: true, message: 'Task deleted' });
  } catch (err) { next(err); }
};

module.exports = { createTask, getTasksByBoard, moveTask, deleteTask };
