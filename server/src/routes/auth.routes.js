//all the code+comments written are cross verified with the documentation ; if u have any suggestions for improvement please let me know :)


import express from "express";
import { getMe, login, register, requestPasswordReset, resendEmailOtp, resetPassword, verifyEmailOtp } from "../controllers/auth.controller.js";
import { updateMyProfile } from "../controllers/profile.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();//mini router to handle auth related routes

router.post("/register", register);
router.post("/login", login);
router.post("/verify-email", verifyEmailOtp);
router.post("/verify-email/resend", resendEmailOtp);
router.post("/forgot-password", requestPasswordReset);
router.post("/reset-password", resetPassword);
router.get("/me", protect, getMe);
router.put("/user/update", protect, updateMyProfile);

export default router;
