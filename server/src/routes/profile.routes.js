import express from "express";
import { getMyProfile, updateMyProfile } from "../controllers/profile.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/", protect, getMyProfile);
router.put("/", protect, updateMyProfile);

export default router;
