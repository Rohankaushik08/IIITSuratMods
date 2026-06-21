import express from "express";
import { createSlot, deleteSlot, getTodayTimetable, getWeeklyTimetable, updateSlot } from "../controllers/timetable.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/today", protect, getTodayTimetable);
router.get("/weekly", protect, getWeeklyTimetable);
router.post("/", protect, createSlot);
router.put("/:id", protect, updateSlot);
router.delete("/:id", protect, deleteSlot);

export default router;
