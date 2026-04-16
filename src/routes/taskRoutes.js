const express = require('express');
const router = express.Router();
const { createTask, getTasksByBoard, moveTask, deleteTask } = require('../controllers/taskController');
const authenticate = require('../middleware/authenticate');

router.use(authenticate);

router.post('/', createTask);
router.get('/board/:boardId', getTasksByBoard);
router.patch('/:id/move', moveTask);
router.delete('/:id', deleteTask);

module.exports = router;
