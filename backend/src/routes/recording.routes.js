import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { Recording } from "../models/recording.model.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const recordingsDir = path.join(__dirname, "../../uploads/recordings");
if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, recordingsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".webm";
    cb(null, `recording-${Date.now()}${ext}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });

const router = Router();

router.post("/upload", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No audio file provided" });
  }

  try {
    const recording = await Recording.create({
      meetingId: req.body.meetingId || "unknown",
      recordingPath: req.file.path,
    });

    return res.json({
      success: true,
      fileUrl: `/uploads/recordings/${req.file.filename}`,
      recordingId: recording._id,
    });
  } catch (err) {
    fs.unlink(req.file.path, () => {});
    return res.status(500).json({ error: "Failed to save recording metadata" });
  }
});

export default router;
