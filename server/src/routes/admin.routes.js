import express from "express";
import {
  createSchedule,
  deleteSchedule,
  getAdminSummary,
  listSchedules,
  updateSchedule
} from "../controllers/admin.controller.js";
import { protect, requireAdmin } from "../middleware/auth.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = express.Router();

router.use(protect, requireAdmin);

router.get("/summary", asyncHandler(getAdminSummary));
router.get("/schedules", asyncHandler(listSchedules));
router.post("/schedules", asyncHandler(createSchedule));
router.put("/schedules/:id", asyncHandler(updateSchedule));
router.delete("/schedules/:id", asyncHandler(deleteSchedule));

export default router;
