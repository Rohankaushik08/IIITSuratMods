import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/Auth";
import api from "../src/api";
import "./styling/venues.css";
import "./styling/admin.css";

const emptyNotice = {
  title: "",
  message: "",
  audience: "all",
  eventType: "other",
  venueName: "",
  eventDurationMinutes: 60,
  eventAt: "",
  isActive: true,
};

const emptySchedule = {
  dayOfWeek: "monday",
  startTime: "09:00",
  endTime: "10:00",
  roomNo: "",
  batch: "CSE A",
  semester: "",
  program: "B.Tech",
  source: "admin",
  courseCode: "",
  courseName: "",
  facultyName: "",
  rawText: "",
  group: "",
};

const audienceLabels = {
  all: "All users",
  cse: "CSE",
  ece: "ECE",
  mtech: "M.Tech",
  admins: "Admins",
};

const eventTypeLabels = {
  club: "Club event",
  other: "Other",
};

const dayNames = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const DEFAULT_BRANCHES = ["CSE A", "CSE B", "CSE C", "CSE D", "CSE", "ECE"];

// Superseded batch names. Any of these still sitting in old schedule rows
// would otherwise be merged back into the dropdown below, re-offering names
// that no longer exist ("CSE 1"/"CSE 2" are now "CSE A"/"CSE B"; MNC is not
// currently running).
const RETIRED_BRANCHES = ["CSE 1", "CSE 2", "MNC"];

const toTimeValue = (date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;

// Helper: converts single digit "3" to "Semester 3"
const formatSemester = (value) => {
  if (!value) return "";
  const trimmed = String(value).trim();
  return /^\d+$/.test(trimmed) ? `Semester ${trimmed}` : trimmed;
};

export default function Admin() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [venues, setVenues] = useState([]);
  const [notice, setNotice] = useState(emptyNotice);
  const [filter, setFilter] = useState({ day: "", roomNo: "", batch: "", semester: "" });
  const [editingId, setEditingId] = useState(null);
  const [scheduleDraft, setScheduleDraft] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [availability, setAvailability] = useState({
    status: "idle",
    text: "",
  });

  // Branch / Batch state list
  const [branches, setBranches] = useState(DEFAULT_BRANCHES);
  const [customBranchInput, setCustomBranchInput] = useState("");
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);

  // New timetable form state
  const [newSchedule, setNewSchedule] = useState(emptySchedule);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [savingNew, setSavingNew] = useState(false);

  const isAdmin = user?.role === "admin";
  const classroomVenues = venues.filter((venue) => venue.type === "classroom");

  const loadAdminData = useCallback(async () => {
    const formattedFilter = {
      ...filter,
      semester: formatSemester(filter.semester),
    };

    const [
      summaryResponse,
      scheduleResponse,
      notificationResponse,
      venueResponse,
    ] = await Promise.all([
      api.get("/admin/summary"),
      api.get("/admin/schedules", { params: formattedFilter }),
      api.get("/notifications/admin"),
      api.get("/venues"),
    ]);
    setSummary(summaryResponse.data);
    
    // Auto populate existing batches from summary if available
    if (summaryResponse.data?.batches?.length > 0) {
      const fromData = summaryResponse.data.batches.filter((b) => !RETIRED_BRANCHES.includes(b));
      setBranches(Array.from(new Set([...DEFAULT_BRANCHES, ...fromData])));
    }

    setSchedules(scheduleResponse.data.schedules || []);
    setNotifications(notificationResponse.data.notifications || []);
    setVenues(venueResponse.data.venues || []);
  }, [filter]);

  useEffect(() => {
    if (!isAdmin) return;
    loadAdminData().catch(() => setError("Unable to load admin data"));
  }, [isAdmin, loadAdminData]);

  useEffect(() => {
    if (notice.eventType !== "club") {
      setAvailability({ status: "idle", text: "" });
      return;
    }

    if (!notice.venueName || !notice.eventAt || !notice.eventDurationMinutes) {
      setAvailability({
        status: "idle",
        text: "Select a classroom, date, time, and duration to check availability.",
      });
      return;
    }

    const eventDate = new Date(notice.eventAt);
    if (Number.isNaN(eventDate.getTime())) {
      setAvailability({
        status: "unavailable",
        text: "Choose a valid event date and time.",
      });
      return;
    }

    const duration = Number(notice.eventDurationMinutes);
    if (!Number.isFinite(duration) || duration < 15) {
      setAvailability({
        status: "unavailable",
        text: "Duration must be at least 15 minutes.",
      });
      return;
    }

    let cancelled = false;
    setAvailability({
      status: "checking",
      text: "Checking classroom availability...",
    });

    api
      .get("/venues/free", {
        params: {
          day: dayNames[eventDate.getDay()],
          time: toTimeValue(eventDate),
          duration,
        },
      })
      .then((response) => {
        if (cancelled) return;
        const rooms = response.data.rooms || [];
        const isAvailable = rooms.some(
          (room) => room.name === notice.venueName
        );
        setAvailability({
          status: isAvailable ? "available" : "unavailable",
          text: isAvailable
            ? `${notice.venueName} is available for this club event.`
            : `${notice.venueName} is already occupied at this time.`,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setAvailability({
          status: "unavailable",
          text: "Unable to check availability right now.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    notice.eventType,
    notice.venueName,
    notice.eventAt,
    notice.eventDurationMinutes,
  ]);

  const flash = (text) => {
    setMessage(text);
    setError("");
    setTimeout(() => setMessage(""), 4000);
  };

  const handleAddNewBranch = (e) => {
    e.preventDefault();
    const cleanBranch = customBranchInput.trim();
    if (!cleanBranch) return;

    if (!branches.includes(cleanBranch)) {
      setBranches((prev) => [...prev, cleanBranch]);
    }

    setNewSchedule((prev) => ({ ...prev, batch: cleanBranch }));
    setCustomBranchInput("");
    setShowAddBranchModal(false);
    flash(`New branch "${cleanBranch}" added to dropdown.`);
  };

  const createNotification = async (event) => {
    event.preventDefault();
    setPublishing(true);
    setMessage("");
    setError("");
    try {
      await api.post("/notifications", {
        ...notice,
        venueName: notice.eventType === "club" ? notice.venueName : "",
        eventDurationMinutes:
          notice.eventType === "club"
            ? Number(notice.eventDurationMinutes || 60)
            : 60,
        eventAt: notice.eventAt || null,
        expiresAt: null,
      });
      setNotice(emptyNotice);
      await loadAdminData();
      flash("Notification published — it is now visible to users.");
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to create notification"
      );
    } finally {
      setPublishing(false);
    }
  };

  const toggleNotification = async (notification) => {
    try {
      await api.put(`/notifications/${notification._id}`, {
        isActive: !notification.isActive,
      });
      await loadAdminData();
    } catch {
      setError("Unable to update notification");
    }
  };

  const deleteNotification = async (notification) => {
    if (
      !window.confirm(
        `Delete notification "${notification.title}"? This cannot be undone.`
      )
    )
      return;
    try {
      await api.delete(`/notifications/${notification._id}`);
      await loadAdminData();
      flash("Notification deleted.");
    } catch {
      setError("Unable to delete notification");
    }
  };

  const applyFilters = (event) => {
    event.preventDefault();
    loadAdminData().catch(() => setError("Unable to apply filters"));
  };

  const createSchedule = async (event) => {
    event.preventDefault();
    setSavingNew(true);
    setError("");

    const { group, ...scheduleFields } = newSchedule;
    // The schema has no dedicated "group" field — the timetable's group filter
    // detects "Group N" by scanning facultyName/rawText/courseName, so append
    // it to rawText here to keep this admin-created row consistent with the
    // rest of the seeded data instead of needing a schema change.
    const payload = {
      ...scheduleFields,
      rawText: group ? `${scheduleFields.rawText} (Group ${group})`.trim() : scheduleFields.rawText,
      semester: formatSemester(newSchedule.semester),
      program: newSchedule.program || "B.Tech",
      source: newSchedule.source || "admin",
    };

    try {
      await api.post("/admin/schedules", payload);
      setNewSchedule({ ...emptySchedule, batch: branches[0] || "CSE A" });
      setIsAddingNew(false);
      await loadAdminData();
      flash("New schedule entry added successfully.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to create schedule entry");
    } finally {
      setSavingNew(false);
    }
  };

  const deleteSchedule = async (slot) => {
    if (
      !window.confirm(
        `Delete the ${slot.roomNo} ${slot.dayOfWeek} ${slot.startTime} slot?`
      )
    )
      return;
    try {
      await api.delete(`/admin/schedules/${slot._id}`);
      await loadAdminData();
      flash("Schedule entry deleted.");
    } catch {
      setError("Unable to delete schedule");
    }
  };

  const startEditing = (slot) => {
    setEditingId(slot._id);
    setScheduleDraft({
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      batch: slot.batch,
      semester: slot.semester || "",
      program: slot.program || "B.Tech",
      source: slot.source || "admin",
      roomNo: slot.roomNo,
      courseCode: slot.courseCode,
      courseName: slot.courseName,
      facultyName: slot.facultyName,
      rawText: slot.rawText,
    });
  };

  const saveSchedule = async (id) => {
    try {
      const payload = {
        ...scheduleDraft,
        semester: formatSemester(scheduleDraft.semester),
      };
      await api.put(`/admin/schedules/${id}`, payload);
      setEditingId(null);
      setScheduleDraft({});
      await loadAdminData();
      flash("Schedule updated.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save schedule");
    }
  };

  if (!user) {
    return (
      <div className="venue-page">
        <h1>Admin</h1>
        <p className="status-message">
          Please log in with an admin account to open the admin dashboard.
        </p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="venue-page">
        <h1>Admin</h1>
        <p className="status-message">
          Admin access required. Ask a maintainer to promote your account, or
          run <code>npm run make:admin -- {user.email}</code> inside the
          server folder.
        </p>
      </div>
    );
  }

  return (
    <div className="venue-page admin-page">
      <div className="venue-header">
        <div>
          <h1>Admin Panel</h1>
          <p>
            Publish notifications to every user, review imported rooms, and
            modify timetable data.
          </p>
        </div>
      </div>

      {message && (
        <p className="admin-flash admin-flash--success">{message}</p>
      )}
      {error && <p className="admin-flash admin-flash--error">{error}</p>}

      {summary && (
        <section className="admin-metrics">
          <article className="metric-tile metric-tile--lime">
            <span className="metric-label">SCHEDULE ENTRIES</span>
            <strong>{summary.scheduleCount}</strong>
          </article>
          <article className="metric-tile metric-tile--teal">
            <span className="metric-label">VENUES</span>
            <strong>{summary.venueCount}</strong>
          </article>
          <article className="metric-tile metric-tile--purple">
            <span className="metric-label">BATCHES</span>
            <strong>{summary.batches?.length || 0}</strong>
          </article>
          <article className="metric-tile metric-tile--gold">
            <span className="metric-label">NOTIFICATIONS</span>
            <strong>{notifications.length}</strong>
          </article>
        </section>
      )}

      {/* Add New Branch Popup Dialog */}
      {showAddBranchModal && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000,
          padding: "16px",
          boxSizing: "border-box"
        }}>
          <div style={{
            background: "#1e1e24",
            padding: "1.5rem",
            borderRadius: "8px",
            width: "100%",
            maxWidth: "320px",
            boxSizing: "border-box",
            border: "1px solid #333"
          }}>
            <h3 style={{ marginTop: 0, color: "#fff" }}>Add New Branch / Batch</h3>
            <form onSubmit={handleAddNewBranch}>
              <input
                type="text"
                placeholder="e.g. CSE 3 or AI-DS"
                value={customBranchInput}
                onChange={(e) => setCustomBranchInput(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  marginBottom: "1rem",
                  boxSizing: "border-box"
                }}
                autoFocus
                required
              />
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setShowAddBranchModal(false)}
                  style={{ background: "#444", color: "#fff", padding: "0.4rem 0.8rem", borderRadius: "4px" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="find-btn"
                  style={{ width: "auto", padding: "0.4rem 0.8rem" }}
                >
                  Add Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <section className="admin-split">
        <form className="admin-form" onSubmit={createNotification}>
          <h2>Send notification</h2>

          <label className="admin-field admin-field--gold">
            TITLE
            <input
              value={notice.title}
              onChange={(event) =>
                setNotice({ ...notice, title: event.target.value })
              }
              placeholder="Mid-sem exam schedule released"
              required
            />
          </label>

          <label className="admin-field admin-field--teal">
            MESSAGE
            <textarea
              value={notice.message}
              onChange={(event) =>
                setNotice({ ...notice, message: event.target.value })
              }
              placeholder="Details every student should read..."
              required
            />
          </label>

          <label className="admin-field admin-field--purple">
            AUDIENCE
            <select
              value={notice.audience}
              onChange={(event) =>
                setNotice({ ...notice, audience: event.target.value })
              }
            >
              {Object.entries(audienceLabels).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <div className="admin-field-row">
            <label className="admin-field admin-field--gold">
              EVENT TYPE
              <select
                value={notice.eventType}
                onChange={(event) =>
                  setNotice({
                    ...notice,
                    eventType: event.target.value,
                    venueName:
                      event.target.value === "club" ? notice.venueName : "",
                    eventDurationMinutes:
                      event.target.value === "club"
                        ? notice.eventDurationMinutes
                        : 60,
                  })
                }
              >
                {Object.entries(eventTypeLabels).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            {notice.eventType === "club" && (
              <label className="admin-field admin-field--teal">
                CLASSROOM
                <select
                  value={notice.venueName}
                  onChange={(event) =>
                    setNotice({ ...notice, venueName: event.target.value })
                  }
                  required
                >
                  <option value="">Select classroom</option>
                  {classroomVenues.map((venue) => (
                    <option value={venue.name} key={venue.name}>
                      {venue.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="admin-field-row">
            <label className="admin-field admin-field--lime">
              EVENT DATE & TIME
              <input
                type="datetime-local"
                value={notice.eventAt}
                onChange={(event) =>
                  setNotice({ ...notice, eventAt: event.target.value })
                }
                required={notice.eventType === "club"}
              />
            </label>
            {notice.eventType === "club" && (
              <label className="admin-field admin-field--coral">
                DURATION (MIN)
                <input
                  type="number"
                  min="15"
                  step="15"
                  value={notice.eventDurationMinutes}
                  onChange={(event) =>
                    setNotice({
                      ...notice,
                      eventDurationMinutes: event.target.value,
                    })
                  }
                  required
                />
              </label>
            )}
          </div>

          {notice.eventType === "club" && availability.text && (
            <p
              className={`admin-availability admin-availability--${availability.status}`}
            >
              {availability.text}
            </p>
          )}

          <button
            type="submit"
            className="admin-publish-btn"
            disabled={
              publishing ||
              (notice.eventType === "club" &&
                availability.status !== "available")
            }
          >
            {publishing ? "PUBLISHING..." : "PUBLISH TO USERS"}
          </button>
        </form>

        <section className="venue-section">
          <h2>Published notifications</h2>
          <div className="admin-list">
            {notifications.length === 0 && (
              <p className="empty-state">
                Nothing published yet. Send your first notification.
              </p>
            )}
            {notifications.map((item) => (
              <article className="admin-row notification-row" key={item._id}>
                <div>
                  <div className="notification-row__top">
                    <strong>{item.title}</strong>
                    <span
                      className={`status-chip ${
                        item.isActive ? "status-chip--live" : "status-chip--off"
                      }`}
                    >
                      {item.isActive ? "LIVE" : "HIDDEN"}
                    </span>
                    <span className="audience-chip">
                      {audienceLabels[item.audience] || item.audience}
                    </span>
                    <span className="audience-chip">
                      {eventTypeLabels[item.eventType] || "Other"}
                    </span>
                    {item.eventType === "club" && item.venueName && (
                      <span className="audience-chip">{item.venueName}</span>
                    )}
                  </div>
                  <span>{item.message}</span>
                  {item.eventAt && (
                    <time>
                      Event: {new Date(item.eventAt).toLocaleString()}
                    </time>
                  )}
                  {item.eventType === "club" && (
                    <time>
                      Duration: {item.eventDurationMinutes || 60} minutes
                    </time>
                  )}
                </div>
                <div className="row-actions">
                  <button
                    type="button"
                    onClick={() => toggleNotification(item)}
                  >
                    {item.isActive ? "Hide" : "Show"}
                  </button>
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={() => deleteNotification(item)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="venue-section">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          <h2>Timetable data</h2>
          <button
            type="button"
            className="find-btn"
            style={{ width: "auto", padding: "0.5rem 1.2rem" }}
            onClick={() => setIsAddingNew(!isAddingNew)}
          >
            {isAddingNew ? "Close Form" : "+ Add Timetable Slot"}
          </button>
        </div>

        {/* Add New Timetable Entry Form */}
        {isAddingNew && (
          <form
            className="admin-form"
            onSubmit={createSchedule}
            style={{ marginBottom: "2rem" }}
          >
            <h3>Add New Schedule Slot</h3>

            <div className="admin-field-row">
              <label className="admin-field admin-field--purple">
                DAY OF WEEK
                <select
                  value={newSchedule.dayOfWeek}
                  onChange={(e) =>
                    setNewSchedule({ ...newSchedule, dayOfWeek: e.target.value })
                  }
                  required
                >
                  {[
                    "monday",
                    "tuesday",
                    "wednesday",
                    "thursday",
                    "friday",
                    "saturday",
                    "sunday",
                  ].map((day) => (
                    <option key={day} value={day}>
                      {day.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-field admin-field--lime">
                START TIME
                <input
                  type="time"
                  value={newSchedule.startTime}
                  onChange={(e) =>
                    setNewSchedule({ ...newSchedule, startTime: e.target.value })
                  }
                  required
                />
              </label>

              <label className="admin-field admin-field--lime">
                END TIME
                <input
                  type="time"
                  value={newSchedule.endTime}
                  onChange={(e) =>
                    setNewSchedule({ ...newSchedule, endTime: e.target.value })
                  }
                  required
                />
              </label>
            </div>

            <div className="admin-field-row">
              <label className="admin-field admin-field--gold">
                ROOM NO
                {/* Free text here let a typo ("CR2", "Room 2") reach the
                    database, where it no longer matched any known venue — the
                    class then vanished from the venue timetable and left the
                    room looking free in "find a free room". The list is the
                    same one the venues API serves, so the two can't drift. */}
                <select
                  value={newSchedule.roomNo}
                  onChange={(e) =>
                    setNewSchedule({ ...newSchedule, roomNo: e.target.value })
                  }
                  required
                >
                  <option value="">Select room</option>
                  {venues.map((venue) => (
                    <option key={venue.name} value={venue.name}>
                      {venue.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-field admin-field--teal">
                BRANCH / BATCH
                <select
                  value={newSchedule.batch}
                  onChange={(e) => {
                    if (e.target.value === "__NEW__") {
                      setShowAddBranchModal(true);
                    } else {
                      setNewSchedule({ ...newSchedule, batch: e.target.value });
                    }
                  }}
                  required
                >
                  {branches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                  <option value="__NEW__">+ Add New Branch...</option>
                </select>
              </label>

              <label className="admin-field admin-field--coral">
                SEMESTER
                <input
                  value={newSchedule.semester}
                  onChange={(e) =>
                    setNewSchedule({ ...newSchedule, semester: e.target.value })
                  }
                  placeholder="e.g. 3"
                  required
                />
              </label>

              <label className="admin-field admin-field--purple">
                PROGRAM
                <select
                  value={newSchedule.program}
                  onChange={(e) =>
                    setNewSchedule({ ...newSchedule, program: e.target.value })
                  }
                  required
                >
                  <option value="B.Tech">B.Tech</option>
                  <option value="M.Tech">M.Tech</option>
                  <option value="Ph.D">Ph.D</option>
                </select>
              </label>
            </div>

            <div className="admin-field-row">
              <label className="admin-field admin-field--purple">
                COURSE CODE
                <input
                  value={newSchedule.courseCode}
                  onChange={(e) =>
                    setNewSchedule({
                      ...newSchedule,
                      courseCode: e.target.value,
                    })
                  }
                  placeholder="e.g. CS101"
                  required
                />
              </label>

              <label className="admin-field admin-field--gold">
                SOURCE
                <input
                  value={newSchedule.source}
                  onChange={(e) =>
                    setNewSchedule({ ...newSchedule, source: e.target.value })
                  }
                  placeholder="e.g. admin"
                  required
                />
              </label>

              <label className="admin-field admin-field--teal">
                LAB GROUP
                <select
                  value={newSchedule.group}
                  onChange={(e) =>
                    setNewSchedule({ ...newSchedule, group: e.target.value })
                  }
                >
                  <option value="">Not split</option>
                  <option value="1">Group 1</option>
                  <option value="2">Group 2</option>
                </select>
              </label>
            </div>

            <label className="admin-field admin-field--gold">
              DETAILS / RAW TEXT
              <textarea
                value={newSchedule.rawText}
                onChange={(e) =>
                  setNewSchedule({ ...newSchedule, rawText: e.target.value })
                }
                placeholder="Course title, Faculty name or additional slot details..."
              />
            </label>

            <button
              type="submit"
              className="admin-publish-btn"
              disabled={savingNew}
            >
              {savingNew ? "SAVING..." : "CREATE SCHEDULE SLOT"}
            </button>
          </form>
        )}

        {/* Filter Section */}
        <form className="finder-panel" onSubmit={applyFilters}>
          <label className="field--day">
            DAY
            <select
              value={filter.day}
              onChange={(event) =>
                setFilter({ ...filter, day: event.target.value })
              }
            >
              <option value="">Any day</option>
              {[
                "monday",
                "tuesday",
                "wednesday",
                "thursday",
                "friday",
                "saturday",
              ].map((day) => (
                <option value={day} key={day}>
                  {day}
                </option>
              ))}
            </select>
          </label>
          <label className="field--start">
            ROOM
            <input
              value={filter.roomNo}
              onChange={(event) =>
                setFilter({ ...filter, roomNo: event.target.value })
              }
              placeholder="CR 2"
            />
          </label>
          <label className="field--duration">
            BRANCH / BATCH
            <select
              value={filter.batch}
              onChange={(event) => {
                if (event.target.value === "__NEW__") {
                  setShowAddBranchModal(true);
                } else {
                  setFilter({ ...filter, batch: event.target.value });
                }
              }}
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option value={b} key={b}>
                  {b}
                </option>
              ))}
              <option value="__NEW__">+ Add New Branch...</option>
            </select>
          </label>
          <label className="field--duration">
            SEMESTER
            <input
              value={filter.semester}
              onChange={(event) =>
                setFilter({ ...filter, semester: event.target.value })
              }
              placeholder="3"
            />
          </label>
          <button className="find-btn" type="submit">
            FILTER SCHEDULES
          </button>
        </form>

        {/* Schedule List */}
        <div className="admin-list">
          {schedules.map((slot) => (
            <article className="admin-row" key={slot._id}>
              {editingId === slot._id ? (
                <div className="schedule-editor">
                  <input
                    value={scheduleDraft.dayOfWeek}
                    onChange={(event) =>
                      setScheduleDraft({
                        ...scheduleDraft,
                        dayOfWeek: event.target.value,
                      })
                    }
                  />
                  <input
                    type="time"
                    value={scheduleDraft.startTime}
                    onChange={(event) =>
                      setScheduleDraft({
                        ...scheduleDraft,
                        startTime: event.target.value,
                      })
                    }
                  />
                  <input
                    type="time"
                    value={scheduleDraft.endTime}
                    onChange={(event) =>
                      setScheduleDraft({
                        ...scheduleDraft,
                        endTime: event.target.value,
                      })
                    }
                  />
                  <select
                    value={scheduleDraft.roomNo}
                    onChange={(event) =>
                      setScheduleDraft({
                        ...scheduleDraft,
                        roomNo: event.target.value,
                      })
                    }
                  >
                    {/* Keep an unknown legacy value selectable so editing an
                        old row doesn't silently rewrite its room. */}
                    {scheduleDraft.roomNo && !venues.some((v) => v.name === scheduleDraft.roomNo) && (
                      <option value={scheduleDraft.roomNo}>{scheduleDraft.roomNo}</option>
                    )}
                    {venues.map((venue) => (
                      <option key={venue.name} value={venue.name}>
                        {venue.name}
                      </option>
                    ))}
                  </select>
                  <input
                    value={scheduleDraft.courseCode}
                    onChange={(event) =>
                      setScheduleDraft({
                        ...scheduleDraft,
                        courseCode: event.target.value,
                      })
                    }
                  />
                  <select
                    value={scheduleDraft.batch}
                    onChange={(event) => {
                      if (event.target.value === "__NEW__") {
                        setShowAddBranchModal(true);
                      } else {
                        setScheduleDraft({
                          ...scheduleDraft,
                          batch: event.target.value,
                        });
                      }
                    }}
                  >
                    {branches.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                    <option value="__NEW__">+ Add New Branch...</option>
                  </select>
                  <input
                    value={scheduleDraft.semester}
                    placeholder="Sem"
                    onChange={(event) =>
                      setScheduleDraft({
                        ...scheduleDraft,
                        semester: event.target.value,
                      })
                    }
                  />
                  <textarea
                    value={scheduleDraft.rawText}
                    onChange={(event) =>
                      setScheduleDraft({
                        ...scheduleDraft,
                        rawText: event.target.value,
                      })
                    }
                  />
                </div>
              ) : (
                <div>
                  <strong>
                    {slot.roomNo} · {slot.dayOfWeek} {slot.startTime} - {slot.endTime}
                  </strong>
                  <span>
                    {slot.batch} {slot.semester ? `(${slot.semester})` : ""} | {slot.courseCode} | {slot.rawText}
                  </span>
                </div>
              )}

              <div className="row-actions">
                {editingId === slot._id ? (
                  <>
                    <button type="button" onClick={() => saveSchedule(slot._id)}>
                      Save
                    </button>
                    <button type="button" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => startEditing(slot)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="danger-btn"
                      onClick={() => deleteSchedule(slot)}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}