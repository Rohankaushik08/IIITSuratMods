import Notification from "../models/Notification.js";
import { FIXED_VENUES } from "../data/venues.js";

const notificationFields = [
  "title",
  "message",
  "audience",
  "eventType",
  "venueName",
  "eventDurationMinutes",
  "eventAt",
  "expiresAt",
  "isActive"
];

const pickNotificationFields = (body) =>
  Object.fromEntries(notificationFields.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]));

const validateClubEvent = async (fields, res) => {
  if (fields.eventType !== "club") return true;

  if (!fields.venueName) {
    res.status(400).json({ message: "Choose a classroom for club events" });
    return false;
  }

  if (!fields.eventAt) {
    res.status(400).json({ message: "Choose an event date for club events" });
    return false;
  }

  const duration = Number(fields.eventDurationMinutes || 60);
  if (!Number.isFinite(duration) || duration < 15) {
    res.status(400).json({ message: "Choose a valid club event duration" });
    return false;
  }
  fields.eventDurationMinutes = duration;

  const venue = FIXED_VENUES.find((v) => v.name === fields.venueName);
  if (venue && venue.type !== "classroom") {
    res.status(400).json({ message: "Club events can only reserve classrooms" });
    return false;
  }

  return true;
};

export const listPublicNotifications = async (req, res) => {
  const now = new Date();
  const notifications = await Notification.find({
    isActive: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }]
  })
    .sort({ eventAt: 1, createdAt: -1 })
    .limit(20)
    .lean();

  res.json({ notifications });
};

export const listNotifications = async (req, res) => {
  const notifications = await Notification.find({}).sort({ createdAt: -1 }).lean();
  res.json({ notifications });
};

export const createNotification = async (req, res) => {
  const fields = pickNotificationFields(req.body);
  if (fields.eventType !== "club") {
    fields.venueName = "";
    fields.eventDurationMinutes = 60;
  }
  fields.expiresAt = null;
  if (!(await validateClubEvent(fields, res))) return;

  const notification = await Notification.create({ ...fields, createdBy: req.user._id });
  res.status(201).json({ message: "Notification created", notification });
};

export const updateNotification = async (req, res) => {
  const fields = pickNotificationFields(req.body);
  if (fields.eventType && fields.eventType !== "club") {
    fields.venueName = "";
    fields.eventDurationMinutes = 60;
  }
  if (!(await validateClubEvent(fields, res))) return;

  const notification = await Notification.findByIdAndUpdate(req.params.id, fields, {
    new: true,
    runValidators: true
  });

  if (!notification) return res.status(404).json({ message: "Notification not found" });
  res.json({ message: "Notification updated", notification });
};

export const deleteNotification = async (req, res) => {
  const notification = await Notification.findByIdAndDelete(req.params.id);
  if (!notification) return res.status(404).json({ message: "Notification not found" });
  res.json({ message: "Notification deleted" });
};
