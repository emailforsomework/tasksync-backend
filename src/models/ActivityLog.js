const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { 
    type: String, 
    enum: ['CREATE_TASK', 'MOVE_TASK', 'DELETE_TASK', 'UPDATE_TASK', 'MEMBER_JOINED'], 
    required: true 
  },
  details: { type: mongoose.Schema.Types.Mixed }, // e.g. { taskTitle: 'Fix issue', from: 'TODO', to: 'DONE' }
}, { timestamps: true });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
