import { Router } from "express";
import ActionItem from "../models/actionItem.model.js";

const router = Router();

router.get("/meeting/:meetingId", async (req, res) => {
    try {
        const { meetingId } = req.params;
        const items = await ActionItem.find({ meetingId }).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, count: items.length, data: items });
    } catch (error) {
        console.error("Error fetching action items:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch action items" });
    }
});

router.patch("/:id/toggle", async (req, res) => {
    try {
        const { id } = req.params;
        const item = await ActionItem.findById(id);
        if (!item) {
            return res.status(404).json({ success: false, message: "Action item not found" });
        }
        item.status = item.status === 'pending' ? 'completed' : 'pending';
        await item.save();
        return res.status(200).json({ success: true, data: item });
    } catch (error) {
        console.error("Error toggling action item:", error);
        return res.status(500).json({ success: false, message: "Failed to toggle action item" });
    }
});

export default router;