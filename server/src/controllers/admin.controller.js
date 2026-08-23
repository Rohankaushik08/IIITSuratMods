import ClassSchedule from "../models/ClassSchedule.js";
import { FIXED_VENUES } from "../data/venues.js";
import { normalizeRoomName } from "../utils/normalizeRoom.js";
import { parseTimeToMinutes } from "../utils/time.js";

const scheduleFields = [
  "source",
  "program",
  "semester",
  "batch",
  "dayOfWeek",
  "startTime",
  "endTime",
  "courseCode",
  "courseName",
  "facultyName",
  "roomNo",
  "rawText",
  "isCancelled"
];

const pickFields = (fields, body) =>
  Object.fromEntries(fields.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]));

const withMinutes = (data) => {
  const next = { ...data };
  if (next.startTime) next.startMinutes = parseTimeToMinutes(next.startTime);
  if (next.endTime) next.endMinutes = parseTimeToMinutes(next.endTime);
  return next;
};

// rawText is the original line lifted from a scraped PDF, so a manually added
// row has nothing natural to put there — but the schema requires it, which
// made every admin-created slot fail validation with an opaque 500 whenever
// the (optional-looking) details field was left blank. Derive it from the
// fields the admin did fill in instead of rejecting the request.
const withDerivedRawText = (data) => {
  if (data.rawText && data.rawText.trim()) return data;
  const derived = [data.courseCode, data.courseName, data.roomNo, data.facultyName]
    .map((part) => (part || "").trim())
    .filter(Boolean)
    .join(" ");
  return { ...data, rawText: derived };
};

const canonicalRoomByKey = new Map(FIXED_VENUES.map((v) => [normalizeRoomName(v.name), v.name]));

const resolveRoomNo = (body) => {
  if (body.roomNo === undefined) return { data: body, error: null };
  const canonical = canonicalRoomByKey.get(normalizeRoomName(body.roomNo));
  if (!canonical) return { data: null, error: `Unknown room "${body.roomNo}"` };
  return { data: { ...body, roomNo: canonical }, error: null };
};

export const getAdminSummary = async (req, res) => {
  const [scheduleCount, batches] = await Promise.all([
    ClassSchedule.countDocuments({}),
    ClassSchedule.distinct("batch")
  ]);

  res.json({ scheduleCount, venueCount: FIXED_VENUES.length, batches });
};

export const listSchedules = async (req, res) => {
  const filter = {};
  if (req.query.roomNo) filter.roomNo = req.query.roomNo;
  if (req.query.batch) filter.batch = req.query.batch;
  if (req.query.day) filter.dayOfWeek = String(req.query.day).toLowerCase();

  const schedules = await ClassSchedule.find(filter).sort({ dayOfWeek: 1, startMinutes: 1 }).limit(300).lean();
  res.json({ schedules });
};

// Mongoose validation errors are surfaced by the central error handler as a
// raw 500 ("ClassSchedule validation failed: courseCode: Path `courseCode` is
// required."), which reads as a server outage in the UI. Convert them to a
// 400 naming the fields the admin actually needs to fill in.
const validationMessage = (error) => {
  if (error?.name !== "ValidationError") return null;
  const fields = Object.keys(error.errors || {});
  if (!fields.length) return "Invalid schedule data";
  return `Missing or invalid: ${fields.join(", ")}`;
};

export const createSchedule = async (req, res) => {
  const { data, error } = resolveRoomNo(req.body);
  if (error) return res.status(400).json({ message: error });

  try {
    const schedule = await ClassSchedule.create(withDerivedRawText(withMinutes(pickFields(scheduleFields, data))));
    res.status(201).json({ message: "Schedule created", schedule });
  } catch (err) {
    const message = validationMessage(err);
    if (!message) throw err;
    res.status(400).json({ message });
  }
};

export const updateSchedule = async (req, res) => {
  const { data, error } = resolveRoomNo(req.body);
  if (error) return res.status(400).json({ message: error });

  try {
    const schedule = await ClassSchedule.findByIdAndUpdate(
      req.params.id,
      withDerivedRawText(withMinutes(pickFields(scheduleFields, data))),
      { new: true, runValidators: true }
    );

    if (!schedule) return res.status(404).json({ message: "Schedule not found" });
    res.json({ message: "Schedule updated", schedule });
  } catch (err) {
    const message = validationMessage(err);
    if (!message) throw err;
    res.status(400).json({ message });
  }
};

export const deleteSchedule = async (req, res) => {
  const schedule = await ClassSchedule.findByIdAndDelete(req.params.id);
  if (!schedule) return res.status(404).json({ message: "Schedule not found" });
  res.json({ message: "Schedule deleted" });
};
