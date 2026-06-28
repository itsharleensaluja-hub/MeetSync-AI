import mongoose, { Schema } from "mongoose";

const pendingActionItemSchema = new Schema({
  task: { type: String, required: true },
  assignedTo: { type: String, default: 'Unassigned' },
  dueDate: { type: Date, default: null },
  sourceMeetingCode: { type: String, required: true },
}, { _id: false });

const pastDecisionSchema = new Schema({
  text: { type: String, required: true },
  proposedBy: { type: String, default: '' },
  timestamp: { type: String, default: '' },
  meetingCode: { type: String, required: true },
}, { _id: false });

const participantSetSchema = new Schema({
  userIds: [String],
  userNames: [String],
}, { _id: false });

const threadMemorySchema = new Schema({
  threadId: { type: String, required: true, unique: true, index: true },
  meetingCodes: [String],
  participantSets: [participantSetSchema],
  summary: { type: String, default: '' },
  pendingActionItems: [pendingActionItemSchema],
  pastDecisions: [pastDecisionSchema],
  patterns: [String],
  lastMeetingEnded: { type: Date, default: null },
}, { timestamps: true });

export const ThreadMemory = mongoose.model("ThreadMemory", threadMemorySchema);
