const express = require('express');
const router = express.Router();
const { createBoard, getBoards, getBoardById, inviteMember } = require('../controllers/boardController');
const authenticate = require('../middleware/authenticate');

router.use(authenticate); // Protect all board routes

router.post('/', createBoard);
router.get('/', getBoards);
router.get('/:id', getBoardById);
router.post('/:id/members', inviteMember);

module.exports = router;
