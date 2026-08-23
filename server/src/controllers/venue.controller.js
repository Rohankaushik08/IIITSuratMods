import ClassSchedule from "../models/ClassSchedule.js";
import Notification from "../models/Notification.js";
import { FIXED_VENUES } from "../data/venues.js";
import { normalizeRoomName } from "../utils/normalizeRoom.js";
import { days, formatMinutes, overlaps, parseTimeToMinutes } from "../utils/time.js";

const jsDayToName = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const dateToMinutes = (date) => date.getHours() * 60 + date.getMinutes();

const getAllVenues = async () => FIXED_VENUES;

export const listVenues = async (req, res) => {
  const query = String(req.query.q || "").trim().toLowerCase();
  const venues = await getAllVenues();
  const filtered = query ? venues.filter((v) => v.name.toLowerCase().includes(query)) : venues;
  res.json({ venues: filtered });
};

export const getVenue = async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const venue = FIXED_VENUES.find((v) => v.name === name) || { name, type: "classroom" };
  const target = normalizeRoomName(name);

  const schedules = (await ClassSchedule.find({ isCancelled: false }).lean())
    .filter((s) => normalizeRoomName(s.roomNo) === target)
    .sort((a, b) => a.startMinutes - b.startMinutes);

  res.json({ venue, schedules });
};

export const findFreeRooms = async (req, res) => {
  const dayOfWeek = String(req.query.day || "").toLowerCase();
  const start = parseTimeToMinutes(String(req.query.time || ""));
  const duration = Number(req.query.duration || 60);

  if (!days.includes(dayOfWeek) || start === null || !Number.isFinite(duration) || duration <= 0) {
    return res.status(400).json({ message: "Provide day, time, and a positive duration in minutes" });
  }

  const end = start + duration;
  const schedules = await ClassSchedule.find({ dayOfWeek, isCancelled: false }).lean();
  const busyRooms = new Set(
    schedules
      .filter((slot) => overlaps(slot.startMinutes, slot.endMinutes, start, end))
      .map((slot) => normalizeRoomName(slot.roomNo))
  );

  const now = new Date();
  const clubEvents = await Notification.find({
    eventType: "club",
    venueName: { $ne: "" },
    isActive: true,
    eventAt: { $ne: null },
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }]
  }).lean();

  clubEvents.forEach((event) => {
    const eventStart = new Date(event.eventAt);
    const eventDuration = Number(event.eventDurationMinutes || 60);
    const eventEnd = new Date(eventStart.getTime() + eventDuration * 60 * 1000);
    if (eventEnd <= now) return;
    if (jsDayToName[eventStart.getDay()] !== dayOfWeek) return;
    if (overlaps(dateToMinutes(eventStart), dateToMinutes(eventEnd), start, end)) {
      busyRooms.add(normalizeRoomName(event.venueName));
    }
  });

  const rooms = FIXED_VENUES.filter((venue) => !busyRooms.has(normalizeRoomName(venue.name))).map((venue) => ({
    ...venue,
    freeFrom: formatMinutes(start),
    freeUntil: formatMinutes(end)
  }));

  res.json({ dayOfWeek, startTime: formatMinutes(start), endTime: formatMinutes(end), rooms });
};
