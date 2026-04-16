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

    // Respond to user immediately for maximum perceived performance
    res.status(201).json({ success: true, task });

    // ─── Post-Response Tasks (Background) ─────────────────────────────────────
    (async () => {
      try {
        // Run Sync and Logging in parallel to minimize latency for other users
        const [allTasks] = await Promise.all([
          Task.find({ boardId }).sort({ position: 1 }),
          ActivityLog.create({
            boardId,
            userId: req.user.id,
            action: 'CREATE_TASK',
            details: { taskTitle: title }
          })
        ]);

        console.log(`Broadcasting task:sync for board ${boardId}`);
        getIO().to(`board:${boardId}`).emit('task:sync', { boardId, tasks: allTasks });
      } catch (err) {
        console.error('Background task sync failure:', err.message);
      }
    })();
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

    // Respond to user immediately after the core operation is successful
    res.json({ success: true, message: 'Task moved successfully' });

    // ─── Post-Response Tasks (Background) ─────────────────────────────────────
    (async () => {
      try {
        // Fetch tasks and log activity in parallel
        const [allTasks] = await Promise.all([
          Task.find({ boardId }).sort({ position: 1 }),
          ActivityLog.create({
            boardId,
            userId: req.user.id,
            action: 'MOVE_TASK',
            details: { taskId: id, from: sourceStatus, to: destinationStatus }
          })
        ]);

        getIO().to(`board:${boardId}`).emit('task:sync', { boardId, tasks: allTasks });
      } catch (err) {
        console.error('Background move sync failure:', err.message);
      }
    })();
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

    // Respond to user immediately after the core deletion is successful
    res.json({ success: true, message: 'Task deleted' });

    // ─── Post-Response Tasks (Background) ─────────────────────────────────────
    (async () => {
      try {
        const [allTasks] = await Promise.all([
          Task.find({ boardId }).sort({ position: 1 }),
          ActivityLog.create({
            boardId,
            userId: req.user.id,
            action: 'DELETE_TASK',
            details: { taskTitle: task.title }
          })
        ]);

        getIO().to(`board:${boardId}`).emit('task:sync', { boardId, tasks: allTasks });
      } catch (err) {
        console.error('Background delete sync failure:', err.message);
      }
    })();
  } catch (err) { next(err); }
};

module.exports = { createTask, getTasksByBoard, moveTask, deleteTask };
