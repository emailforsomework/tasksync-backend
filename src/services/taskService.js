const Task = require('../models/Task');

/**
 * Atomic reindexing of tasks in one or two columns.
 * @param {string} boardId
 * @param {object} moveInfo { taskId, sourceStatus, destStatus, newPosition }
 */
const reorderTasks = async (boardId, { taskId, sourceStatus, destStatus, newPosition }) => {
  const isSameColumn = sourceStatus === destStatus;

  if (isSameColumn) {
    // ─── Same Column Move ──────────────────────────────────────────────────────
    const tasks = await Task.find({ boardId, status: sourceStatus }).sort({ position: 1 });
    const targetIndex = tasks.findIndex(t => t._id.toString() === taskId);
    if (targetIndex === -1) return;

    const [movedTask] = tasks.splice(targetIndex, 1);
    tasks.splice(newPosition, 0, movedTask);

    const bulkOps = tasks.map((t, idx) => ({
      updateOne: {
        filter: { _id: t._id },
        update: { position: idx }
      }
    }));

    await Task.bulkWrite(bulkOps);
  } else {
    // ─── Cross Column Move ─────────────────────────────────────────────────────
    const sourceTasks = await Task.find({ boardId, status: sourceStatus }).sort({ position: 1 });
    const destTasks = await Task.find({ boardId, status: destStatus }).sort({ position: 1 });

    const sourceIndex = sourceTasks.findIndex(t => t._id.toString() === taskId);
    if (sourceIndex === -1) return;

    const [movedTask] = sourceTasks.splice(sourceIndex, 1);
    
    // Update moved task metadata for destination
    movedTask.status = destStatus;
    destTasks.splice(newPosition, 0, movedTask);

    const bulkOps = [
      ...sourceTasks.map((t, idx) => ({
        updateOne: {
          filter: { _id: t._id },
          update: { position: idx }
        }
      })),
      ...destTasks.map((t, idx) => ({
        updateOne: {
          filter: { _id: t._id },
          update: { position: idx, status: destStatus }
        }
      }))
    ];

    await Task.bulkWrite(bulkOps);
  }
};

/**
 * Get next position for a new task in a specific column.
 */
const getNextPosition = async (boardId, status) => {
  const lastTask = await Task.findOne({ boardId, status }).sort({ position: -1 });
  return lastTask ? lastTask.position + 1 : 0;
};

module.exports = { reorderTasks, getNextPosition };
