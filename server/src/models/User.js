//all the code+comments written are cross verified with the documentation ; if u have any suggestions for improvement please let me know :)

import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    emailVerified: {
      type: Boolean,
      default: false
    },
    emailOtpHash: {
      type: String,
      select: false
    },
    emailOtpExpiresAt: {
      type: Date,
      select: false
    },
    emailOtpAttempts: {
      type: Number,
      default: 0,
      select: false
    },
    emailOtpLastSentAt: {
      type: Date,
      select: false
    },
    passwordResetOtpHash: {
      type: String,
      select: false
    },
    passwordResetOtpExpiresAt: {
      type: Date,
      select: false
    },
    passwordResetOtpAttempts: {
      type: Number,
      default: 0,
      select: false
    },
    passwordResetOtpLastSentAt: {
      type: Date,
      select: false
    },
    password: {
      type: String,
      required: true,
      minlength: 8
    },
    batch: {
      type: String,
      required: true,
      enum: ["CSE", "CSE 1", "CSE 2", "CSE A", "CSE B", "CSE C", "CSE D", "MNC", "ECE"],
      trim: true
    },
    semester: {
      type: String,
      required: true,
      enum: [
        "Semester 1",
        "Semester 2",
        "Semester 3",
        "Semester 4",
        "Semester 5",
        "Semester 6",
        "Semester 7",
        "Semester 8"
      ],
      trim: true
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user"
    }
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }//If password did not change, we do not hash it again.

  const salt = await bcrypt.genSalt(10);//Salt makes password hashes harder to attack.
  this.password = await bcrypt.hash(this.password, salt);//replaces plain with hashed password 
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

// It compares:
// 1. password user typed
// 2. password hash stored in database

const User = mongoose.model("User", userSchema);//creates a model, A model is what we use to talk to the MongoDB collection.

export default User;
