import mongoose, { Schema } from "mongoose";

const transcriptEntrySchema = new Schema({
  text:      { type: String, required: true },
  speaker:   { type: String, default: "Anonymous" },
  lang:      { type: String, default: "en-IN" },
  timestamp: { type: Number, required: true },
}, { _id: false });

const transcriptSchema = new Schema({
  meetingId: { type: String, required: true, unique: true, index: true },
  entries:   [transcriptEntrySchema],
  summary:   { type: Object, default: null },
  createdAt: { type: Date, default: Date.now },
});

export const Transcript = mongoose.model("Transcript", transcriptSchema);
