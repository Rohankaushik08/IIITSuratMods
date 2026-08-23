import { useEffect, useState } from 'react';
import './styling/timetable.css'
import { weeklyTimetableMock } from '../MockData/WeeklyTimeTable';
import { useAuth } from '../context/Auth';
import api from '../src/api';

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayKeys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const subjectColors = ["lime", "yellow", "teal", "coral", "purple", "orange"];

const HOUR = 60;

const formatSlot = (slot) =>
  slot
    .replace(/\s?AM|\s?PM/g, "")
    .replace(" - ", "\n-\n")
    .replace(/^0/, "");

const formatSeedTime = (time) => {
  const [hourValue, minuteValue] = String(time).split(":").map(Number);
  if (!Number.isFinite(hourValue) || !Number.isFinite(minuteValue)) return time;

  const meridiem = hourValue >= 12 ? "PM" : "AM";
  const hour = hourValue % 12 || 12;
  return `${String(hour).padStart(2, "0")}:${String(minuteValue).padStart(2, "0")} ${meridiem}`;
};

const minutesToTime = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const getSubjectMap = (rows) => {
  const map = new Map();

  rows.forEach((row) => {
    row.schedule.forEach((cell) => {
      if (!cell || cell === "covered") return;
      cell.forEach((course) => {
        if (map.has(course.courseCode)) return;
        map.set(course.courseCode, {
          ...course,
          color: subjectColors[map.size % subjectColors.length]
        });
      });
    });
  });

  return map;
};

// "Group N" shows up in different fields depending on which PDF a row was
// transcribed from — parenthesized in facultyName ("NB / PG25CS01 (Group 1)")
// for newer entries, or bare in rawText ("... CR1 Group 3") for older ones.
// A row can also legitimately mention more than one group ("Group 1, Group 2")
// when it's shared by both instead of split — that's not exclusive to either,
// so it stays visible no matter which group is selected.
//
// Some non-lab rows (electives held in a regular CR room) also carry a
// "Group N" tag for unrelated reasons (elective-section grouping, not a
// parallel lab split) — the group filter is only meaningful for labs, so
// group numbers are only parsed off rows that are actually in a lab room.
const parseGroupNumbers = (slot) => {
  if (!/lab/i.test(slot.roomNo || "")) return [];
  const haystack = [slot.facultyName, slot.rawText, slot.courseName].filter(Boolean).join(" ");
  const matches = [...haystack.matchAll(/Group\s*(\d+)/gi)].map((m) => Number(m[1]));
  return [...new Set(matches)];
};

const normalizeCourse = (slot) => ({
  _id: slot._id,
  courseCode: slot.courseCode,
  courseName: slot.courseName || slot.rawText,
  facultyName: slot.facultyName,
  roomNo: slot.roomNo,
  dayOfWeek: slot.dayOfWeek,
  startTime: slot.startTime,
  endTime: slot.endTime,
  batch: slot.batch,
  semester: slot.semester,
  program: slot.program,
  source: slot.source,
  rawText: slot.rawText,
  groups: parseGroupNumbers(slot),
  isLab: typeof slot.courseCode === "string" && slot.courseCode.includes("/")
});

// Every source timetable is laid out 9 AM-6 PM, but a batch whose own
// classes happen to end earlier (e.g. nothing after 5 PM) would otherwise
// render a shorter grid than every other batch. Always show the full
// 9-6 span — Math.min/max so it only ever widens for a genuine outlier
// class outside that window, never clips one.
const DAY_START_MINUTES = 9 * 60;
const DAY_END_MINUTES = 18 * 60;

const buildRowsFromSchedules = (schedules) => {
  if (!schedules.length) return [];

  // Real span of this batch's own classes — used below so the "lunch break"
  // banner only ever applies to a genuine gap between classes, not to the
  // padding added to reach the fixed 9-6 display range.
  const realMinStart = Math.min(...schedules.map((s) => s.startMinutes));
  const realMaxEnd = Math.max(...schedules.map((s) => s.endMinutes));

  const minStart = Math.min(DAY_START_MINUTES, realMinStart);
  const maxEnd = Math.max(DAY_END_MINUTES, realMaxEnd);

  const hourStarts = [];
  for (let t = minStart; t < maxEnd; t += HOUR) hourStarts.push(t);

  return hourStarts.map((start) => {
    const end = start + HOUR;

    const schedule = dayKeys.map((day) => {
      const covering = schedules.find(
        (item) =>
          item.dayOfWeek === day &&
          item.startMinutes < start &&
          item.endMinutes > start
      );
      if (covering) return "covered";

      const matches = schedules.filter(
        (item) => item.dayOfWeek === day && item.startMinutes === start
      );
      if (!matches.length) return null;

      const rowSpan = Math.max(1, Math.round((matches[0].endMinutes - matches[0].startMinutes) / HOUR));
      return matches.map((match) => ({ ...normalizeCourse(match), rowSpan }));
    });

    // Every hour is an ordinary slot, lunch included. Lunch lands at a
    // different hour per batch and per day, so singling one column out as a
    // styled "break" made the grid inconsistent between semesters and hid a
    // slot admins sometimes need to schedule into.
    return {
      timeSlot: `${formatSeedTime(minutesToTime(start))} - ${formatSeedTime(minutesToTime(end))}`,
      rawStartTime: minutesToTime(start),
      rawEndTime: minutesToTime(end),
      schedule
    };
  });
};

const emptyEditForm = { courseCode: "", courseName: "", facultyName: "", roomNo: "" };
const emptyAddForm = { courseCode: "", courseName: "", facultyName: "", roomNo: "", duration: "1" };

const addHours = (time, hours) => {
  const [h, m] = String(time).split(":").map(Number);
  const total = h * 60 + m + hours * 60;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

export default function TimeTable(props) {
  const { user } = useAuth();
  const [importedSchedules, setImportedSchedules] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");

  const isAdmin = user?.role === "admin";

  // --- Group filter (labs split into parallel Group 1 / Group 2 / ... rooms) ---
  const [groupFilter, setGroupFilter] = useState("all");

  // --- Edit / delete existing slot ---
  const [editingCourse, setEditingCourse] = useState(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [deleting, setDeleting] = useState(false);

  // --- Add new slot into a blank cell ---
  const [addingSlot, setAddingSlot] = useState(null); // { dayOfWeek, startTime, endTime }
  const [addForm, setAddForm] = useState(emptyAddForm);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  // Canonical room list, so an admin editing the timetable can only pick a
  // room the venues feature also knows about (a free-typed room used to end
  // up in the schedule but match no venue, breaking free-room lookups).
  const [venues, setVenues] = useState([]);

  useEffect(() => {
    if (!isAdmin) return;
    api
      .get("/venues")
      .then((response) => setVenues(response.data.venues || []))
      .catch(() => setVenues([]));
  }, [isAdmin]);

  useEffect(() => {
    if (!user) {
      setImportedSchedules([]);
      setLoaded(true);
      setLoadError("");
      return;
    }

    setLoaded(false);
    api
      .get("/timetable/imported/weekly")
      .then((response) => {
        setImportedSchedules(response.data.slots || []);
        setLoadError("");
      })
      .catch(() => {
        setImportedSchedules([]);
        setLoadError("Unable to load timetable data from the database.");
      })
      .finally(() => {
        setLoaded(true);
      });
  }, [user]);

  const data = importedSchedules.length
    ? buildRowsFromSchedules(importedSchedules)
    : !user
    ? weeklyTimetableMock.map((row) => ({
        ...row,
        schedule: row.schedule.map((cell) => (cell ? [cell] : cell))
      }))
    : [];
  const subjectMap = getSubjectMap(data);
  const section = user ? `${user.batch} · ${user.semester}` : "Sample CSE timetable";

  const availableGroups = [
    ...new Set(
      data.flatMap((row) =>
        row.schedule.flatMap((cell) => (cell && cell !== "covered" ? cell.flatMap((c) => c.groups || []) : []))
      )
    )
  ].sort((a, b) => a - b);

  // A row with no group tag at all (most classes) is shown regardless of the
  // selected group. A row tagged with more than one group is shared, not
  // split, so it also stays visible either way. Only a row exclusively
  // tagged for the *other* group gets hidden.
  const matchesGroupFilter = (course) => {
    const groups = course.groups || [];
    return groupFilter === "all" || groups.length !== 1 || groups[0] === Number(groupFilter);
  };

  // --- Edit handlers ---
  const openEdit = (course) => {
    if (!isAdmin || !course?._id) return;
    setEditingCourse(course);
    setEditForm({
      courseCode: course.courseCode || "",
      courseName: course.courseName || "",
      facultyName: course.facultyName || "",
      roomNo: course.roomNo || ""
    });
    setSaveError("");
  };

  const closeEdit = () => {
    setEditingCourse(null);
    setEditForm(emptyEditForm);
    setSaveError("");
  };

  const handleEditFormChange = (field) => (e) => {
    setEditForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = async () => {
    if (!editingCourse?._id) return;
    setSaving(true);
    setSaveError("");

    const payload = {
      dayOfWeek: editingCourse.dayOfWeek,
      startTime: editingCourse.startTime,
      endTime: editingCourse.endTime,
      batch: editingCourse.batch,
      semester: editingCourse.semester,
      program: editingCourse.program,
      source: editingCourse.source,
      roomNo: editForm.roomNo,
      courseCode: editForm.courseCode,
      courseName: editForm.courseName,
      facultyName: editForm.facultyName,
      rawText: editingCourse.rawText
    };

    try {
      await api.put(`/admin/schedules/${editingCourse._id}`, payload);

      setImportedSchedules((prev) =>
        prev.map((slot) =>
          slot._id === editingCourse._id
            ? {
                ...slot,
                courseCode: editForm.courseCode,
                courseName: editForm.courseName,
                facultyName: editForm.facultyName,
                roomNo: editForm.roomNo
              }
            : slot
        )
      );

      closeEdit();
    } catch (err) {
      setSaveError(err.response?.data?.message || "Couldn't save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingCourse?._id) return;
    const confirmed = window.confirm(
      `Delete ${editingCourse.courseCode} · ${editingCourse.dayOfWeek} ${editingCourse.startTime}? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeleting(true);
    setSaveError("");

    try {
      await api.delete(`/admin/schedules/${editingCourse._id}`);
      setImportedSchedules((prev) => prev.filter((slot) => slot._id !== editingCourse._id));
      closeEdit();
    } catch (err) {
      setSaveError(err.response?.data?.message || "Couldn't delete this slot. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  // --- Add handlers ---
  const openAdd = (dayOfWeek, startTime, endTime) => {
    if (!isAdmin) return;
    setAddingSlot({ dayOfWeek, startTime, endTime });
    setAddForm(emptyAddForm);
    setAddError("");
  };

  const closeAdd = () => {
    setAddingSlot(null);
    setAddForm(emptyAddForm);
    setAddError("");
  };

  const handleAddFormChange = (field) => (e) => {
    setAddForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleAddSave = async () => {
    if (!addingSlot) return;
    if (!addForm.courseCode.trim() || !addForm.roomNo.trim()) {
      setAddError("Course code and room are required.");
      return;
    }

    setAdding(true);
    setAddError("");

    const duration = Number(addForm.duration) || 1;
    const payload = {
      dayOfWeek: addingSlot.dayOfWeek,
      startTime: addingSlot.startTime,
      endTime: duration === 2 ? addHours(addingSlot.startTime, 2) : addingSlot.endTime,
      roomNo: addForm.roomNo,
      batch: user?.batch || "CSE A",
      semester: user?.semester || "",
      program: "B.Tech",
      source: "admin",
      courseCode: addForm.courseCode,
      courseName: addForm.courseName,
      facultyName: addForm.facultyName,
      rawText: addForm.courseName
    };

    try {
      const response = await api.post("/admin/schedules", payload);
      const created = response.data?.schedule || { ...payload, _id: response.data?._id };
      setImportedSchedules((prev) => [...prev, created]);
      closeAdd();
    } catch (err) {
      setAddError(err.response?.data?.message || "Couldn't add this slot. Please try again.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <section className="schedule-page" style={{ "--slot-count": data.length || 1 }}>
      <header className="schedule-hero">
        <div>
          <h1>Weekly Timetable</h1>
          <p>Academic Year {props.year} · {section}</p>
        </div>
        {availableGroups.length > 0 && (
          <label className="group-filter">
            GROUP
            <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
              <option value="all">Both groups</option>
              {availableGroups.map((g) => (
                <option value={g} key={g}>
                  Group {g}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      {user && loadError && <p className="schedule-empty">{loadError}</p>}
      {user && !loadError && loaded && data.length === 0 && (
        <p className="schedule-empty">No timetable is available in the database for {user.batch} {user.semester} yet.</p>
      )}

      {data.length > 0 && (
        <div className="schedule-layout">
          <div className="schedule-grid-wrap">
            <div className="schedule-grid--days">
              <div />
              {data.map((row) => (
                <div className="time-cell time-cell--header" key={`head-${row.timeSlot}`}>
                  {formatSlot(row.timeSlot)}
                </div>
              ))}
            </div>

            <div
              className="schedule-rows schedule-rows--grid"
              style={{ gridTemplateRows: `repeat(${dayKeys.length}, auto)` }}
            >
              {dayKeys.map((dayKey, dayIdx) => (
                <div key={dayKey} style={{ display: "contents" }}>
                  <div className="day-heading day-heading--row" style={{ gridRow: dayIdx + 1, gridColumn: 1 }}>
                    {days[dayIdx]}
                  </div>

                  {data.map((row, colIdx) => {
                    const course = row.schedule[dayIdx];
                    const key = `${dayKey}-${row.timeSlot}`;

                    if (course === "covered") return null;

                    // A split lab cell (two parallel group entries) is unreadable
                    // stacked by default and ambiguous without picking a group —
                    // prompt for a selection instead of guessing which to show.
                    const isSplitLab = course && course.length > 1 && course.some((c) => (c.groups || []).length === 1);
                    if (course && groupFilter === "all" && isSplitLab) {
                      return (
                        <div
                          className="course-cell"
                          style={{
                            gridRow: dayIdx + 1,
                            gridColumn: `${colIdx + 2} / span ${course[0].rowSpan || 1}`
                          }}
                          key={key}
                        >
                          <div className="course-block course-block--prompt">
                            <p>Select your group above to see this lab</p>
                          </div>
                        </div>
                      );
                    }

                    const visibleCourses = course ? course.filter(matchesGroupFilter) : [];

                    if (!visibleCourses.length) {
                      if (isAdmin && row.rawStartTime && row.rawEndTime) {
                        return (
                          <button
                            type="button"
                            className="empty-cell empty-cell--addable"
                            style={{ gridRow: dayIdx + 1, gridColumn: colIdx + 2 }}
                            key={key}
                            onClick={() => openAdd(dayKey, row.rawStartTime, row.rawEndTime)}
                            aria-label={`Add a slot for ${days[dayIdx]} ${row.timeSlot}`}
                          >
                            <span className="add-icon">+</span>
                          </button>
                        );
                      }
                      return (
                        <div
                          className="empty-cell"
                          style={{ gridRow: dayIdx + 1, gridColumn: colIdx + 2 }}
                          key={key}
                        />
                      );
                    }

                    return (
                      <div
                        className="course-cell"
                        style={{
                          gridRow: dayIdx + 1,
                          gridColumn: `${colIdx + 2} / span ${visibleCourses[0].rowSpan || 1}`
                        }}
                        key={key}
                      >
                        {visibleCourses.map((c) => {
                          const color = subjectMap.get(c.courseCode)?.color || "lime";
                          return (
                            <article
                              className={`course-block block--${color}${c.isLab ? " course-block--lab" : ""}`}
                              key={c._id || `${key}-${c.courseCode}-${c.roomNo}`}
                            >
                              <h3 title={c.courseCode}>{c.courseCode}</h3>
                              <p className="course-faculty" title={c.facultyName}>{c.facultyName}</p>
                              <strong title={c.roomNo}>{c.roomNo}</strong>
                              {isAdmin && (
                                <button
                                  type="button"
                                  className="edit-hint"
                                  onClick={() => openEdit(c)}
                                  aria-label={`Edit ${c.courseCode}`}
                                >
                                  Edit
                                </button>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <aside className="schedule-sidebar">
            <section className="sidebar-panel">
              <h2>Subjects</h2>
              <div className="legend-list">
                {[...subjectMap.entries()].map(([code, course]) => (
                  <div className="legend-item" key={code}>
                    <span className={`legend-swatch block--${course.color}`} />
                    <p><strong>{code}</strong> · {course.courseName}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="note-panel">
              <h2>Note:</h2>
              <p>Lab sessions run in CSE LAB 2/3 and ECE LAB 3. Lecture rooms are CR 5 and CR 6.</p>
            </section>
          </aside>
        </div>
      )}

      {isAdmin && editingCourse && (
        <div className="edit-modal-backdrop" onClick={closeEdit}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit {editingCourse.courseCode}</h2>

            <label>
              Course Code
              <input type="text" value={editForm.courseCode} onChange={handleEditFormChange("courseCode")} />
            </label>

            <label>
              Course Name
              <input type="text" value={editForm.courseName} onChange={handleEditFormChange("courseName")} />
            </label>

            <label>
              Faculty
              <input type="text" value={editForm.facultyName} onChange={handleEditFormChange("facultyName")} />
            </label>

            <label>
              Room No.
              <select value={editForm.roomNo} onChange={handleEditFormChange("roomNo")}>
                {editForm.roomNo && !venues.some((v) => v.name === editForm.roomNo) && (
                  <option value={editForm.roomNo}>{editForm.roomNo}</option>
                )}
                {venues.map((venue) => (
                  <option key={venue.name} value={venue.name}>
                    {venue.name}
                  </option>
                ))}
              </select>
            </label>

            {saveError && <p className="edit-error">{saveError}</p>}

            <div className="edit-modal-actions edit-modal-actions--split">
              <button
                type="button"
                className="danger-btn"
                onClick={handleDelete}
                disabled={saving || deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
              <div className="edit-modal-actions">
                <button onClick={closeEdit} disabled={saving || deleting}>Cancel</button>
                <button onClick={handleSave} disabled={saving || deleting}>
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAdmin && addingSlot && (
        <div className="edit-modal-backdrop" onClick={closeAdd}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <h2>
              Add slot · {addingSlot.dayOfWeek} {formatSeedTime(addingSlot.startTime)}–
              {formatSeedTime(Number(addForm.duration) === 2 ? addHours(addingSlot.startTime, 2) : addingSlot.endTime)}
            </h2>

            <label>
              Duration
              <select value={addForm.duration} onChange={handleAddFormChange("duration")}>
                <option value="1">1 hour</option>
                <option value="2">2 hours (lab)</option>
              </select>
            </label>

            <label>
              Course Code
              <input type="text" value={addForm.courseCode} onChange={handleAddFormChange("courseCode")} placeholder="e.g. CS101" />
            </label>

            <label>
              Course Name
              <input type="text" value={addForm.courseName} onChange={handleAddFormChange("courseName")} />
            </label>

            <label>
              Faculty
              <input type="text" value={addForm.facultyName} onChange={handleAddFormChange("facultyName")} />
            </label>

            <label>
              Room No.
              <select value={addForm.roomNo} onChange={handleAddFormChange("roomNo")}>
                <option value="">Select room</option>
                {venues.map((venue) => (
                  <option key={venue.name} value={venue.name}>
                    {venue.name}
                  </option>
                ))}
              </select>
            </label>

            {addError && <p className="edit-error">{addError}</p>}

            <div className="edit-modal-actions">
              <button onClick={closeAdd} disabled={adding}>Cancel</button>
              <button onClick={handleAddSave} disabled={adding}>
                {adding ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}