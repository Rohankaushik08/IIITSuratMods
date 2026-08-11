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
    if (row.isBreak) return;
    row.schedule.forEach((course) => {
      if (!course || course === "covered" || map.has(course.courseCode)) return;
      map.set(course.courseCode, {
        ...course,
        color: subjectColors[map.size % subjectColors.length]
      });
    });
  });

  return map;
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
  isLab: typeof slot.courseCode === "string" && slot.courseCode.includes("/")
});

const buildRowsFromSchedules = (schedules) => {
  if (!schedules.length) return [];

  const minStart = Math.min(...schedules.map((s) => s.startMinutes));
  const maxEnd = Math.max(...schedules.map((s) => s.endMinutes));

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

      const match = schedules.find(
        (item) => item.dayOfWeek === day && item.startMinutes === start
      );
      if (!match) return null;

      const rowSpan = Math.max(1, Math.round((match.endMinutes - match.startMinutes) / HOUR));
      return { ...normalizeCourse(match), rowSpan };
    });

    const isBreak = schedule.every((c) => c === null);

    return {
      timeSlot: `${formatSeedTime(minutesToTime(start))} - ${formatSeedTime(minutesToTime(end))}`,
      rawStartTime: minutesToTime(start),
      rawEndTime: minutesToTime(end),
      isBreak,
      label: isBreak ? "Lunch Break" : undefined,
      schedule
    };
  });
};

const emptyEditForm = { courseCode: "", courseName: "", facultyName: "", roomNo: "" };
const emptyAddForm = { courseCode: "", courseName: "", facultyName: "", roomNo: "" };

export default function TimeTable(props) {
  const { user } = useAuth();
  const [importedSchedules, setImportedSchedules] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");

  const isAdmin = user?.role === "admin";

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

  const data = importedSchedules.length ? buildRowsFromSchedules(importedSchedules) : !user ? weeklyTimetableMock : [];
  const subjectMap = getSubjectMap(data);
  const section = user ? `${user.batch} · ${user.semester}` : "Sample CSE timetable";

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

    const payload = {
      dayOfWeek: addingSlot.dayOfWeek,
      startTime: addingSlot.startTime,
      endTime: addingSlot.endTime,
      roomNo: addForm.roomNo,
      batch: user?.batch || "CSE 1",
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
                <div
                  className={`time-cell time-cell--header${row.isBreak ? " time-cell--header-break" : ""}`}
                  key={`head-${row.timeSlot}`}
                >
                  {row.isBreak ? (
                    <>
                      {row.label && <span className="break-label">{row.label}</span>}
                      {formatSlot(row.timeSlot)}
                    </>
                  ) : (
                    formatSlot(row.timeSlot)
                  )}
                </div>
              ))}
            </div>

            <div
              className="schedule-rows schedule-rows--grid"
              style={{ gridTemplateRows: `repeat(${dayKeys.length}, auto)` }}
            >
              {data.map((row, colIdx) =>
                row.isBreak ? (
                  <div
                    className="banner-row banner-row--vertical"
                    style={{ gridRow: `1 / span ${dayKeys.length}`, gridColumn: colIdx + 2 }}
                    key={`break-${row.timeSlot}`}
                  >
                  </div>
                ) : null
              )}

              {dayKeys.map((dayKey, dayIdx) => (
                <div key={dayKey} style={{ display: "contents" }}>
                  <div className="day-heading day-heading--row" style={{ gridRow: dayIdx + 1, gridColumn: 1 }}>
                    {days[dayIdx]}
                  </div>

                  {data.map((row, colIdx) => {
                    if (row.isBreak) return null; 

                    const course = row.schedule[dayIdx];
                    const key = `${dayKey}-${row.timeSlot}`;

                    if (course === "covered") return null;

                    if (!course) {
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

                    const color = subjectMap.get(course.courseCode)?.color || "lime";
                    return (
                      <article
                        className={`course-block block--${color}${course.isLab ? " course-block--lab" : ""}`}
                        style={{
                          gridRow: dayIdx + 1,
                          gridColumn: `${colIdx + 2} / span ${course.rowSpan || 1}`
                        }}
                        key={`${key}-${course.courseCode}`}
                      >
                        <h3 title={course.courseCode}>{course.courseCode}</h3>
                        <p className="course-title" title={course.courseName}>{course.courseName}</p>
                        <p className="course-faculty" title={course.facultyName}>{course.facultyName}</p>
                        <strong title={course.roomNo}>{course.roomNo}</strong>
                        {isAdmin && (
                          <button
                            type="button"
                            className="edit-hint"
                            onClick={() => openEdit(course)}
                            aria-label={`Edit ${course.courseCode}`}
                          >
                            Edit
                          </button>
                        )}
                      </article>
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
              <input type="text" value={editForm.roomNo} onChange={handleEditFormChange("roomNo")} />
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
            <h2>Add slot · {addingSlot.dayOfWeek} {formatSeedTime(addingSlot.startTime)}–{formatSeedTime(addingSlot.endTime)}</h2>

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
              <input type="text" value={addForm.roomNo} onChange={handleAddFormChange("roomNo")} placeholder="e.g. CR 2" />
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