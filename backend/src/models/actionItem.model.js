import mongoose from "mongoose";

const actionItemSchema = new mongoose.Schema({
  meetingId: { type: String, required: true },
  meetingOwner: { type: String, default: '' },
  task: { type: String, required: true },
  assignedTo: { type: String, default: 'Unassigned' },
  dueDate: { type: Date, default: null },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('ActionItem', actionItemSchema);