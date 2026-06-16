export const coursesLookup = {
  "CS201": { title: "Data Structures and Algorithms", room: "CR 6 / LAB 1", type: "lecture" },
  "CS202": { title: "ICT Workshop-II", room: "CSE LAB 3 / LAB 2", type: "lab" },
  "EC201": { title: "Digital System", room: "CR 6 / ECE LAB 3", type: "lecture" },
  "MS201": { title: "Probability Theory & Stochastic Processes", room: "CR 6 / CR 5", type: "lecture" },
  "MS202": { title: "Discrete Mathematics", room: "CR 6 / CR 5", type: "lecture" },
  "HS201": { title: "Effective Analytical Skills", room: "CR 6", type: "special" }
};
export const weeklyTimetableMock = [
  {
    timeSlot: "09:00 AM - 10:00 AM",
    isBreak:false,
    schedule: ["CS202", "HS201", "CS201", null, "CS201","EC201"] 
  },
  {
    timeSlot: "10:00 AM - 11:00 AM",
    isBreak:false,
    schedule: ["CS202", "HS201", "CS201", "EC201", "CS201",null]
  },
  {
    timeSlot: "11:00 AM - 12:00 PM",
    isBreak:false,
    schedule: ["MS201", "MS202", "CS201", "CS202", "EC201","EC201"]
  },
  {
    timeSlot: "12:00 PM - 01:00 PM",
    isBreak: true,
    label: "LUNCH BREAK" 
  },
  {
    timeSlot: "01:00 PM - 02:00 PM",
    isBreak:false,
    schedule: ["CS202", "MS202", "MS201", "CS202", "EC201","HS201"]
  },
  {
    timeSlot: "02:00 PM - 03:00 PM",
    isBreak:false,
    schedule: ["EC201", "MS202", "MS201", "HS201", "MS202",null]
  },
  {
    timeSlot: "03:00 PM - 04:00 PM",
    isBreak:false,
    schedule: ["EC201", "MS201", "CS201", "MS202", "MS201",null]
  },
  {
    timeSlot: "04:00 PM - 05:00 PM",
    isBreak: true,
    label: "EXTRA TIME" 
  }
];