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

export const createSchedule = async (req, res) => {
  const { data, error } = resolveRoomNo(req.body);
  if (error) return res.status(400).json({ message: error });

  const schedule = await ClassSchedule.create(withMinutes(pickFields(scheduleFields, data)));
  res.status(201).json({ message: "Schedule created", schedule });
};

export const updateSchedule = async (req, res) => {
  const { data, error } = resolveRoomNo(req.body);
  if (error) return res.status(400).json({ message: error });

  const schedule = await ClassSchedule.findByIdAndUpdate(req.params.id, withMinutes(pickFields(scheduleFields, data)), {
    new: true,
    runValidators: true
  });

  if (!schedule) return res.status(404).json({ message: "Schedule not found" });
  res.json({ message: "Schedule updated", schedule });
};

export const deleteSchedule = async (req, res) => {
  const schedule = await ClassSchedule.findByIdAndDelete(req.params.id);
  if (!schedule) return res.status(404).json({ message: "Schedule not found" });
  res.json({ message: "Schedule deleted" });
};
