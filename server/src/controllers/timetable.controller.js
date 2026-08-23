import TimetableSlot from "../models/TimetableSlot.js";
import ClassSchedule from "../models/ClassSchedule.js";
function parseTimeToMinutes(time) {
  if (!time) return null;
  const [hourValue, minuteValue] = String(time).split(":").map(Number);
  if (!Number.isFinite(hourValue) || !Number.isFinite(minuteValue)) return null;
  return hourValue * 60 + minuteValue;
}

// Resolves "today" using a fixed timezone instead of the server's system
// clock. Vercel (and most serverless hosts) run functions in UTC, so
// new Date().getDay() silently returns the wrong day for IST users during
// the UTC/IST offset window. This always resolves against Asia/Kolkata.
function getTodayDayName(timeZone = "Asia/Kolkata") {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" })
    .format(new Date())
    .toLowerCase();
}
// startTime is stored as a string, so a Mongo sort puts "10:00" before "9:00".
// Sort in JS on parsed minutes instead.
const byStartTime = (a, b) => (parseTimeToMinutes(a.startTime) ?? 0) - (parseTimeToMinutes(b.startTime) ?? 0);

const weekOrder = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const byDayThenTime = (a, b) =>
  weekOrder.indexOf(a.dayOfWeek) - weekOrder.indexOf(b.dayOfWeek) || byStartTime(a, b);

const slotFields = ["dayOfWeek", "startTime", "endTime", "courseCode", "courseName", "facultyName", "roomNo", "slotType", "isCancelled"];

const pickSlotFields = (body) =>
  Object.fromEntries(slotFields.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]));

const importedFilterForUser = (user, extra = {}) => ({
  batch: user.batch,
  semester: user.semester,
  isCancelled: false,
  ...extra
});

const importedSort = { dayOfWeek: 1, startMinutes: 1, endMinutes: 1 };

export const getImportedTodayTimetable = async (req, res) => {
  try {
    const day = getTodayDayName();
    const classes = await ClassSchedule.find(importedFilterForUser(req.user, { dayOfWeek: day }))
      .sort({ startMinutes: 1, endMinutes: 1 })
      .lean();

    return res.json({ day, classes });
  } catch (error) {
    return res.status(500).json({ message: "Unable to load today's imported timetable" });
  }
};

export const getImportedWeeklyTimetable = async (req, res) => {
  try {
    const slots = await ClassSchedule.find(importedFilterForUser(req.user)).sort(importedSort).lean();
    return res.json({
      batch: req.user.batch,
      semester: req.user.semester,
      slots
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to load imported weekly timetable" });
  }
};

export const getTodayTimetable = async (req, res) => {
  try {
    const day = getTodayDayName();
    const classes = await TimetableSlot.find({
      user: req.user._id,
      dayOfWeek: day,
      isCancelled: false
    }).lean();
    classes.sort(byStartTime);

    return res.json({ day, classes });
  } catch (error) {
    return res.status(500).json({ message: "Unable to load today's timetable" });
  }
};

export const getWeeklyTimetable = async (req, res) => {
  try {
    const slots = await TimetableSlot.find({ user: req.user._id }).lean();
    slots.sort(byDayThenTime);
    return res.json({ slots });
  } catch (error) {
    return res.status(500).json({ message: "Unable to load weekly timetable" });
  }
};

export const createSlot = async (req, res) => {
  try {
    const slot = await TimetableSlot.create({ user: req.user._id, ...pickSlotFields(req.body) });
    return res.status(201).json({ message: "Timetable slot created", slot });
  } catch (error) {
    return res.status(400).json({ message: "Invalid timetable slot data" });
  }
};

export const updateSlot = async (req, res) => {
  try {
    const slot = await TimetableSlot.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      pickSlotFields(req.body),
      { new: true, runValidators: true }
    );

    if (!slot) {
      return res.status(404).json({ message: "Timetable slot not found" });
    }

    return res.json({ message: "Timetable slot updated", slot });
  } catch (error) {
    return res.status(400).json({ message: "Invalid timetable slot data" });
  }
};

export const deleteSlot = async (req, res) => {
  try {
    const slot = await TimetableSlot.findOneAndDelete({ _id: req.params.id, user: req.user._id });

    if (!slot) {
      return res.status(404).json({ message: "Timetable slot not found" });
    }

    return res.json({ message: "Timetable slot deleted" });
  } catch (error) {
    return res.status(400).json({ message: "Invalid timetable slot id" });
  }
};