import User from "../models/User.js";

const allowedBatches = ["CSE 1", "CSE 2", "MNC", "ECE"];
const allowedSemesters = [
  "Semester 1",
  "Semester 2",
  "Semester 3",
  "Semester 4",
  "Semester 5",
  "Semester 6",
  "Semester 7",
  "Semester 8"
];

const profileResponse = (user) => ({
  id: user._id,
  username: user.username,
  email: user.email,
  emailVerified: user.emailVerified,
  batch: user.batch,
  semester: user.semester
});

export const getMyProfile = async (req, res) => {
  return res.json({ profile: profileResponse(req.user) });
};

export const updateMyProfile = async (req, res) => {
  try {
    const username = req.body.username?.trim();
    const batch = req.body.batch?.trim();
    const semester = req.body.semester?.trim();

    if (!username || !batch || !semester) {
      return res.status(400).json({ message: "Name, batch, and semester are required" });
    }

    if (!allowedBatches.includes(batch) || !allowedSemesters.includes(semester)) {
      return res.status(400).json({ message: "Batch or semester is not valid" });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { username, batch, semester },
      { new: true, runValidators: true }
    );

    return res.json({ message: "Profile updated successfully", user: profileResponse(user) });
  } catch (error) {
    return res.status(500).json({ message: "Unable to update profile" });
  }
};
