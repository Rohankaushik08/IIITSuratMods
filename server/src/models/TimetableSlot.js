import mongoose from "mongoose";

const timetableSlotSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    dayOfWeek: {
      type: String,
      enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
      required: true
    },
    startTime: {
      type: String,
      required: true
    },
    endTime: {
      type: String,
      required: true
    },
    courseCode: {
      type: String,
      required: true,
      trim: true
    },
    courseName: {
      type: String,
      required: true,
      trim: true
    },
    facultyName: {
      type: String,
      required: true,
      trim: true
    },
    roomNo: {
      type: String,
      required: true,
      trim: true
    },
    slotType: {
      type: String,
      enum: ["lecture", "lab", "tutorial"],
      default: "lecture"
    },
    isCancelled: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

timetableSlotSchema.index({ user: 1, dayOfWeek: 1, startTime: 1 });

const TimetableSlot = mongoose.model("TimetableSlot", timetableSlotSchema);

export default TimetableSlot;
