import mongoose, { Schema } from "mongoose";

const recordingSchema = new Schema({
  meetingId: { type: String, required: true },
  recordingPath: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
});

const Recording = mongoose.model("Recording", recordingSchema);
export { Recording };
