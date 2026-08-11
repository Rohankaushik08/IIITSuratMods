export const normalizeRoomName = (value) =>
  String(value || "").trim().toUpperCase().replace(/\s+/g, " ");
