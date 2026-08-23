// Which section names are valid for a given semester. Sections split further
// in earlier years and merge back down later:
//   Sem 1-2: CSE A / CSE B / CSE C / CSE D / ECE  (4-way CSE split)
//   Sem 3-4: CSE A / CSE B / ECE                  (2-way CSE split)
//   Sem 5-8: CSE / ECE                            (no split)
// A cohort doesn't get re-sectioned mid-year, so the even semester in each
// pair mirrors its odd partner.
const BATCH_OPTIONS_BY_SEMESTER = {
  "Semester 1": ["CSE A", "CSE B", "CSE C", "CSE D", "ECE"],
  "Semester 2": ["CSE A", "CSE B", "CSE C", "CSE D", "ECE"],
  "Semester 3": ["CSE A", "CSE B", "ECE"],
  "Semester 4": ["CSE A", "CSE B", "ECE"],
  "Semester 5": ["CSE", "ECE"],
  "Semester 6": ["CSE", "ECE"],
  "Semester 7": ["CSE", "ECE"],
  "Semester 8": ["CSE", "ECE"]
};

const ALL_BATCHES = ["CSE A", "CSE B", "CSE C", "CSE D", "CSE", "ECE"];

export const getBatchOptions = (semester) => BATCH_OPTIONS_BY_SEMESTER[semester] || ALL_BATCHES;
