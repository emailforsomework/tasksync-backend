const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
  title: { type: String, required: true },
  description: { type: String },
  status: { 
    type: String, 
    enum: ['TODO', 'IN_PROGRESS', 'DONE'], 
    default: 'TODO',
    required: true 
  },
  position: { type: Number, required: true }, // Sequential integer re-indexed on the server
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Elite Performance Optimization: 
// Compound index ensures efficient retrieval and sorting during reindexing.
taskSchema.index({ boardId: 1, status: 1, position: 1 });

module.exports = mongoose.model('Task', taskSchema);
