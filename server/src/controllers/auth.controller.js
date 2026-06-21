//all the code+comments written are cross verified with the documentation ; if u have any suggestions for improvement please let me know :)

import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";
import { createOtp, hashOtp, sendEmailOtp, sendPasswordResetOtp } from "../utils/emailVerification.js";

const safeUser = (user) => ({
  id: user._id,
  username: user.username,
  email: user.email,
  emailVerified: user.emailVerified,
  batch: user.batch,
  semester: user.semester
});

const OTP_EXPIRY_MINUTES = 10;
const OTP_COOLDOWN_SECONDS = 60;
const MAX_OTP_ATTEMPTS = 5;

const allowedBatches = ["CSE 1", "CSE 2", "MNC", "ECE"];

const allowedSemesters = [
  "Semester 1",
  "Semester 2",
  "Semester 3",
  "Semester 4",
  "Semester 5",
  "Semester 6",
  "Semester 7",
  "Semester 8"
];

const isCollegeEmail = (email) => {
  const domain = process.env.COLLEGE_EMAIL_DOMAIN;
  if (!domain) {
    return true;
  }

  return email.endsWith(`@${domain}`);
};

const sendVerificationCode = async (user) => {
  const otp = createOtp();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        emailOtpHash: hashOtp(user._id, otp),
        emailOtpExpiresAt: expiresAt,
        emailOtpAttempts: 0,
        emailOtpLastSentAt: now
      }
    }
  );
  await sendEmailOtp({ email: user.email, otp });
};

const sendPasswordResetCode = async (user) => {
  const otp = createOtp();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        passwordResetOtpHash: hashOtp(user._id, otp),
        passwordResetOtpExpiresAt: expiresAt,
        passwordResetOtpAttempts: 0,
        passwordResetOtpLastSentAt: now
      }
    }
  );
  await sendPasswordResetOtp({ email: user.email, otp });
};

export const register = async (req, res) => {
  try {
    let { name, username, email, batch, semester, password } = req.body;

    email = email?.trim().toLowerCase();
    username = (username || name)?.trim();
    batch = batch?.trim();
    semester = semester?.trim();

    if (!username || !email || !batch || !semester || !password) {
      return res.status(400).json({ message: "Please fill all fields" });
    }

    if (!isCollegeEmail(email)) {
      return res.status(400).json({ message: "Use your college email only" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    if (!allowedBatches.includes(batch)) {
      return res.status(400).json({ message: "Please select a valid batch" });
    }

    if (!allowedSemesters.includes(semester)) {
      return res.status(400).json({ message: "Please select a valid semester" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await User.create({ username, email, batch, semester, password });

    try {
      await sendVerificationCode(user);
    } catch (error) {
      await User.deleteOne({ _id: user._id });
      throw error;
    }

    res.status(201).json({
      message: "Account created. Check your email for the verification code.",
      email: user.email
    });
  } catch (error) {
    res.status(503).json({ message: "Unable to send the verification email. Check the server email configuration." });
  }
};

export const login = async (req, res) => {
  try {
    let { email, password } = req.body;

    email = email?.trim().toLowerCase();

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        message: "Verify your email before logging in",
        emailVerificationRequired: true
      });
    }

    const token = generateToken(user._id);

    res.json({
      message: "Logged in successfully",
      user: safeUser(user),
      token
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const verifyEmailOtp = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const otp = req.body.otp?.trim();

    if (!email || !/^\d{6}$/.test(otp || "")) {
      return res.status(400).json({ message: "Enter your email and the 6-digit code" });
    }

    const user = await User.findOne({ email }).select("+emailOtpHash +emailOtpExpiresAt +emailOtpAttempts");
    if (!user || user.emailVerified) {
      return res.status(400).json({ message: "This verification request is no longer valid" });
    }

    if (!user.emailOtpHash || !user.emailOtpExpiresAt || user.emailOtpExpiresAt <= new Date()) {
      return res.status(400).json({ message: "This code has expired. Request a new one." });
    }

    if (user.emailOtpAttempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({ message: "Too many incorrect attempts. Request a new code." });
    }

    if (hashOtp(user._id, otp) !== user.emailOtpHash) {
      user.emailOtpAttempts += 1;
      await user.save();
      return res.status(400).json({ message: "Invalid verification code" });
    }

    user.emailVerified = true;
    user.emailOtpHash = undefined;
    user.emailOtpExpiresAt = undefined;
    user.emailOtpAttempts = 0;
    await user.save();

    const token = generateToken(user._id);
    return res.json({
      message: "Email verified successfully",
      user: safeUser(user),
      token
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to verify email" });
  }
};

export const resendEmailOtp = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email }).select("+emailOtpLastSentAt");
    if (!user || user.emailVerified) {
      return res.json({ message: "If this account needs verification, a code has been sent." });
    }

    const lastSentAt = user.emailOtpLastSentAt?.getTime() || 0;
    const cooldownRemaining = OTP_COOLDOWN_SECONDS * 1000 - (Date.now() - lastSentAt);
    if (cooldownRemaining > 0) {
      return res.status(429).json({
        message: `Wait ${Math.ceil(cooldownRemaining / 1000)} seconds before requesting another code.`
      });
    }

    await sendVerificationCode(user);
    return res.json({ message: "A new verification code has been sent." });
  } catch (error) {
    return res.status(500).json({ message: "Unable to send verification code" });
  }
};

export const requestPasswordReset = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email }).select("+passwordResetOtpLastSentAt");
    const successMessage = "If this account exists, a reset code has been sent.";
    if (!user) {
      return res.json({ message: successMessage });
    }

    const lastSentAt = user.passwordResetOtpLastSentAt?.getTime() || 0;
    const cooldownRemaining = OTP_COOLDOWN_SECONDS * 1000 - (Date.now() - lastSentAt);
    if (cooldownRemaining > 0) {
      return res.status(429).json({
        message: `Wait ${Math.ceil(cooldownRemaining / 1000)} seconds before requesting another code.`
      });
    }

    try {
      await sendPasswordResetCode(user);
    } catch (error) {
      await User.updateOne(
        { _id: user._id },
        {
          $unset: {
            passwordResetOtpHash: "",
            passwordResetOtpExpiresAt: "",
            passwordResetOtpLastSentAt: ""
          },
          $set: { passwordResetOtpAttempts: 0 }
        }
      );
      throw error;
    }
    return res.json({ message: successMessage });
  } catch (error) {
    return res.status(503).json({ message: "Unable to send the password reset email. Check the server email configuration." });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const otp = req.body.otp?.trim();
    const password = req.body.password;

    if (!email || !/^\d{6}$/.test(otp || "") || !password) {
      return res.status(400).json({ message: "Email, 6-digit code, and new password are required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const user = await User.findOne({ email }).select("+passwordResetOtpHash +passwordResetOtpExpiresAt +passwordResetOtpAttempts");
    if (!user || !user.passwordResetOtpHash || !user.passwordResetOtpExpiresAt) {
      return res.status(400).json({ message: "This password reset request is not valid" });
    }

    if (user.passwordResetOtpExpiresAt <= new Date()) {
      return res.status(400).json({ message: "This code has expired. Request a new one." });
    }

    if (user.passwordResetOtpAttempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({ message: "Too many incorrect attempts. Request a new code." });
    }

    if (hashOtp(user._id, otp) !== user.passwordResetOtpHash) {
      user.passwordResetOtpAttempts += 1;
      await user.save();
      return res.status(400).json({ message: "Invalid reset code" });
    }

    user.password = password;
    user.passwordResetOtpHash = undefined;
    user.passwordResetOtpExpiresAt = undefined;
    user.passwordResetOtpAttempts = 0;
    await user.save();

    return res.json({ message: "Password reset successfully. Please log in." });
  } catch (error) {
    return res.status(500).json({ message: "Unable to reset password" });
  }
};

export const getMe = async (req, res) => {
  res.json({ user: req.user });
};
