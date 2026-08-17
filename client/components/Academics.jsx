import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/Auth";
import { parseCurriculum } from "../src/curriculumParser";
import api from "../src/api";
import "./styling/academics.css";

const branchByBatch = {
  "CSE 1": "UGCSE",
  "CSE 2": "UGCSE",
  ECE: "UGECE",
  MNC: "UGMCS"
};

const typeLabels = {
  NEW: "2025 curriculum",
  NEP: "NEP curriculum",
  old: "Older curriculum"
};

const referenceMaterials = [
  {
    title: "NPTEL",
    description: "Lecture series, assignments, and certification material for engineering subjects.",
    url: "https://nptel.ac.in/"
  },
  {
    title: "SWAYAM",
    description: "MOOC courses and reference content from Indian higher-education institutions.",
    url: "https://swayam.gov.in/"
  },
  {
    title: "MIT OpenCourseWare",
    description: "Open lecture notes, readings, and assignments for CS, math, and engineering courses.",
    url: "https://ocw.mit.edu/"
  },
  {
    title: "GeeksforGeeks",
    description: "Topic-wise programming, DSA, DBMS, OS, CN, and interview reference material.",
    url: "https://www.geeksforgeeks.org/"
  }
];

const getAdmissionYear = (email) => {
  const match = String(email || "").match(/^ug(\d{2})/i);
  return match ? 2000 + Number(match[1]) : null;
};

const getSyllabusType = (email) => {
  const admissionYear = getAdmissionYear(email);
  if (!admissionYear) return "NEP";
  if (admissionYear >= 2025) return "NEW";
  if (admissionYear >= 2023) return "NEP";
  return "old";
};

const SUBJECT_HEADER_RE = /^([A-Z]{2,4}\s?-?\s?\d{3,4}[A-Z]?)\s*:\s*(.+?)(?:\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+))?$/;
// Elective-list PDFs give course headers as "Analog VLSI Design 3 0 0 3" with
// no "CODE:" prefix at all. Only tried when a document never uses the normal
// coded header anywhere, so it can't misfire inside a document that already
// parses correctly (a stray "... Edition 2 0 1 0"-shaped line would otherwise
// risk being read as a new subject).
const NAME_LTPC_HEADER_RE = /^([A-Za-z][A-Za-z0-9 &\-/().]{2,58}?)\s+(\d)\s+(\d)\s+(\d)\s+(\d)$/;
const UNIT_RE = /^(?:Unit\s*[–-]?\s*\d+\s*:?\s*)?(.+?)\s+(\d+)\s+Hours?$/i;
const UNIT_WITH_DETAILS_RE = /^(?:Unit\s*[\u2013-]?\s*(\d+)\s*:?\s*)?(.+?)\s+(\d+)\s+Hours?\s+(.+)$/i;
const BOOK_SECTION_RE = /^(Recommended Books|Reference Books|Text-?Books?|Text Books?)$/i;
const CONTACT_RE = /^Total Contact (?:Time|Hours).*?:?\s*(\d+)\s+Hours?$/i;

const normalizeSyllabusLine = (line) =>
  String(line || "")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

const expandSyllabusLines = (lines) =>
  lines.flatMap((rawLine) => {
    let line = normalizeSyllabusLine(rawLine);
    if (!line) return [];

    line = line.replace(/^B\.?\s?TECH\.?(?:-[IVX]+|\.?\s?[IVX]+)?[,]?\s*Semester[-\s]*[IVX0-9]+\s+L\s+T\s+P\s+C\s+/i, "");
    line = line.replace(/\s+(?=B\.?\s?Tech(?:\.|-|,|\s))/gi, "\n");
    line = line.replace(/\s+(?=[A-Z]{2,4}\s?-?\s?\d{3,4}[A-Z]?\s*:)/g, "\n");
    line = line.replace(
      /^([A-Z]{2,4}\s?-?\s?\d{3,4}[A-Z]?\s*:\s*.+?\s+\d+\s+\d+\s+\d+\s+\d+)\s+(.+)$/i,
      "$1\n$2"
    );
    line = line.replace(/\s+(?=Unit\s*-?\s*\d+\s*:?\s+\d+\s+Hours?)/gi, "\n");
    line = line.replace(/\s+(?=[A-Z][A-Z &-]+:?\s+\d+\s+Hours?)/g, "\n");
    line = line.replace(/\s+(?=Total Contact (?:Time|Hours))/gi, "\n");
    line = line.replace(/\s+(?=Recommended Books:?|Reference Books:?|Text-?Books?:?)/gi, "\n");

    return line
      .split("\n")
      .map(normalizeSyllabusLine)
      .filter(Boolean);
  });

const parseSubjectSyllabus = (lines) => {
  const subjects = [];
  let current = null;
  let activeBookSection = "";

  const ensureCurrent = () => {
    if (!current) {
      current = { code: "", name: "Syllabus", credits: null, units: [], books: [], notes: [], contactHours: "" };
      subjects.push(current);
    }
    return current;
  };

  const appendToLastUnit = (text) => {
    const subject = ensureCurrent();
    if (!subject.units.length) {
      subject.notes.push(text);
      return;
    }
    const lastUnit = subject.units[subject.units.length - 1];
    lastUnit.details = `${lastUnit.details} ${text}`.trim();
  };

  const expanded = expandSyllabusLines(lines);
  const hasCodedHeader = expanded.some((line) => SUBJECT_HEADER_RE.test(line));

  expanded.forEach((line) => {
    if (!line) return;
    if (/^B\.?\s?Tech/i.test(line) && !SUBJECT_HEADER_RE.test(line)) return;

    const subjectHeader = line.match(SUBJECT_HEADER_RE);
    if (subjectHeader) {
      const [, code, name, l, t, p, c] = subjectHeader;
      current = {
        code: code.replace(/\s+/g, " ").trim(),
        name: name.replace(/\s+\d+\s+\d+\s+\d+\s+\d+$/, "").trim(),
        credits: c ? { l, t, p, c } : null,
        units: [],
        books: [],
        notes: [],
        contactHours: ""
      };
      subjects.push(current);
      activeBookSection = "";
      return;
    }

    if (!hasCodedHeader && !UNIT_RE.test(line) && !CONTACT_RE.test(line)) {
      const altHeader = line.match(NAME_LTPC_HEADER_RE);
      if (altHeader) {
        const [, name, l, t, p, c] = altHeader;
        current = { code: "", name: name.trim(), credits: { l, t, p, c }, units: [], books: [], notes: [], contactHours: "" };
        subjects.push(current);
        activeBookSection = "";
        return;
      }
    }

    const contact = line.match(CONTACT_RE);
    if (contact && current) {
      current.contactHours = contact[1];
      activeBookSection = "";
      return;
    }

    if (BOOK_SECTION_RE.test(line)) {
      activeBookSection = line;
      return;
    }

    if (activeBookSection || /^\d+\.\s/.test(line)) {
      ensureCurrent().books.push(line.replace(/^\d+\.\s*/, ""));
      return;
    }

    const unit = line.match(UNIT_RE);
    if (unit) {
      ensureCurrent().units.push({ title: unit[1].trim(), hours: unit[2], details: "" });
      activeBookSection = "";
      return;
    }

    const unitWithDetails = line.match(UNIT_WITH_DETAILS_RE);
    if (unitWithDetails) {
      const [, unitNumber, title, hours, details] = unitWithDetails;
      ensureCurrent().units.push({
        title: title.trim() || `Unit ${unitNumber}`,
        hours,
        details: details.trim()
      });
      activeBookSection = "";
      return;
    }

    appendToLastUnit(line);
  });

  return subjects.filter((subject) => subject.code || subject.units.length || subject.books.length);
};

// Some extracted PDFs (policy/guideline documents rather than syllabi) split
// mid-sentence, one or two words per bullet. Re-joining every bullet with a
// space reconstructs the original sentences regardless of how they were
// split, then numbered markers ("1. ...", "2. ...") give natural paragraph
// breaks — far more readable than one <li> per word fragment.
const buildProseParagraphs = (bullets) => {
  const text = bullets.join(" ").replace(/\s+/g, " ").trim();
  if (!text) return [];
  return text
    .split(/\s+(?=\d{1,2}\.\s[A-Z])/g)
    .map((part) => part.trim())
    .filter(Boolean);
};

function ProseBlock({ paragraphs }) {
  return (
    <div className="prose-block">
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  );
}

function SubjectSyllabus({ subjects }) {
  return (
    <div className="subject-syllabus">
      {subjects.map((subject, index) => (
        <article className="subject-card" key={`${subject.code || subject.name}-${index}`}>
          <div className="subject-card__header">
            <div>
              {subject.code && <span className="subject-code">{subject.code}</span>}
              <h4>{subject.name}</h4>
            </div>
            {subject.credits && (
              <div className="credit-pills" aria-label="L T P C">
                <span>L {subject.credits.l}</span>
                <span>T {subject.credits.t}</span>
                <span>P {subject.credits.p}</span>
                <span>C {subject.credits.c}</span>
              </div>
            )}
          </div>

          {subject.units.length > 0 && (
            <div className="unit-list">
              {subject.units.map((unit, unitIndex) => (
                <section className="unit-card" key={`${subject.code}-${unit.title}-${unitIndex}`}>
                  <div className="unit-card__heading">
                    <strong>Unit {unitIndex + 1}</strong>
                    <span>{unit.hours} hours</span>
                  </div>
                  <h5>{unit.title}</h5>
                  {unit.details && <p>{unit.details}</p>}
                </section>
              ))}
            </div>
          )}

          {subject.notes.length > 0 && (
            <div className="subject-notes">
              {subject.notes.map((note, noteIndex) => (
                <p key={`${subject.code}-note-${noteIndex}`}>{note}</p>
              ))}
            </div>
          )}

          {(subject.contactHours || subject.books.length > 0) && (
            <div className="subject-footer">
              {subject.contactHours && <span className="contact-hours">Total contact time: {subject.contactHours} hours</span>}
              {subject.books.length > 0 && (
                <details>
                  <summary>Books and references</summary>
                  <ol>
                    {subject.books.map((book, bookIndex) => (
                      <li key={`${subject.code}-book-${bookIndex}`}>{book}</li>
                    ))}
                  </ol>
                </details>
              )}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

function CourseTable({ section }) {
  return (
    <div className="semester-block">
      <h4 className="semester-title">{section.title}</h4>
      <div className="table-scroll">
        <table className="course-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Course</th>
              <th>Code</th>
              <th>Credits</th>
              <th>L</th>
              <th>T</th>
              <th>P</th>
              <th>Marks</th>
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row, index) => (
              <tr key={`${section.title}-${row.code}-${index}`}>
                <td>{row.sr}</td>
                <td className="course-name">{row.name}</td>
                <td className="course-code">{row.code}</td>
                <td>{row.credit}</td>
                <td>{row.l}</td>
                <td>{row.t}</td>
                <td>{row.p}</td>
                <td>{row.total}</td>
              </tr>
            ))}
          </tbody>
          {section.total && (
            <tfoot>
              <tr>
                <td></td>
                <td>Total</td>
                <td></td>
                <td>{section.total.credit}</td>
                <td colSpan="3"></td>
                <td>{section.total.marks}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function BulletBlock({ title, item, textEntry }) {
  const bullets = textEntry?.bullets || [];
  const parsed = useMemo(() => parseCurriculum(bullets), [bullets]);
  const subjectSyllabus = useMemo(() => parseSubjectSyllabus(bullets), [bullets]);
  const proseParagraphs = useMemo(() => buildProseParagraphs(bullets), [bullets]);

  // Render a structured table when enough of the text parses as course rows;
  // otherwise fall back to the raw extracted lines.
  const showTables = parsed.rowCount >= 5;

  return (
    <article className="curriculum-panel">
      <div className="curriculum-panel__header">
        <div>
          <span>{item?.branchName || "Syllabus"}</span>
          <h3>{title}</h3>
          {item && <p>{typeLabels[item.syllabusType] || item.syllabusType}</p>}
        </div>
        {item?.url && (
          <a href={item.url} target="_blank" rel="noreferrer">
            Source PDF
          </a>
        )}
      </div>

      {showTables ? (
        parsed.sections.map((section) => <CourseTable section={section} key={section.title} />)
      ) : subjectSyllabus.length >= 2 ? (
        <SubjectSyllabus subjects={subjectSyllabus} />
      ) : proseParagraphs.length ? (
        <ProseBlock paragraphs={proseParagraphs} />
      ) : (
        <p className="academics-empty">No text could be extracted for this file.</p>
      )}
    </article>
  );
}

export default function Academics() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("Loading syllabus...");

  useEffect(() => {
    api
      .get("/syllabus")
      .then((response) => {
        setItems(response.data.items || []);
        setStatus("");
      })
      .catch((error) => setStatus(error.response?.data?.message || "Unable to load syllabus data from the database."));
  }, []);

  const profileSelection = useMemo(() => {
    if (!user) return null;

    const branch = branchByBatch[user.batch];
    const syllabusType = getSyllabusType(user.email);
    const semester = user.semester;

    const curriculum =
      items.find((item) => item.branch === branch && item.syllabusType === syllabusType && item.semester === "Curriculum") ||
      items.find((item) => item.branch === branch && item.semester === "Curriculum");

    const semesterSyllabus =
      items.find((item) => item.branch === branch && item.syllabusType === syllabusType && item.semester === semester) ||
      items.find((item) => item.branch === branch && item.semester === semester);

    return { branch, syllabusType, semester, curriculum, semesterSyllabus };
  }, [items, user]);

  if (!user) {
    return (
      <div className="academics-page">
        <h1>Academics</h1>
        <p className="academics-status">Please log in and complete your profile to view your semester syllabus.</p>
      </div>
    );
  }

  return (
    <div className="academics-page">
      <div className="academics-header">
        <div>
          <h1>Academics</h1>
          <p>
            Showing syllabus for {user.batch}, {user.semester}, based on your profile.
          </p>
        </div>
      </div>

      {status && <p className="academics-status">{status}</p>}

      <section className="profile-syllabus-card">
        <strong>{user.username}</strong>
        <span>{user.email}</span>
        <span>
          {user.batch} | {user.semester} | {typeLabels[profileSelection?.syllabusType] || profileSelection?.syllabusType}
        </span>
      </section>

      <section className="academics-section">
        <h2>Curriculum</h2>
        {profileSelection?.curriculum ? (
          <BulletBlock
            title={`${profileSelection.curriculum.branchName} Curriculum`}
            item={profileSelection.curriculum}
            textEntry={{ bullets: profileSelection.curriculum.bullets || [] }}
          />
        ) : (
          <p className="academics-empty">No curriculum found for your profile branch.</p>
        )}
      </section>

      <section className="academics-section">
        <h2>{user.semester} Syllabus</h2>
        {profileSelection?.semesterSyllabus ? (
          <BulletBlock
            title={profileSelection.semesterSyllabus.semester}
            item={profileSelection.semesterSyllabus}
            textEntry={{ bullets: profileSelection.semesterSyllabus.bullets || [] }}
          />
        ) : (
          <p className="academics-empty">
            No semester-specific syllabus is available for {user.batch} {user.semester}. The curriculum above is still available.
          </p>
        )}
      </section>

      <section className="academics-section">
        <h2>Reference Material</h2>
        <div className="reference-grid">
          {referenceMaterials.map((material) => (
            <article className="reference-card" key={material.title}>
              <h3>{material.title}</h3>
              <p>{material.description}</p>
              <a href={material.url} target="_blank" rel="noreferrer">
                Open
              </a>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
