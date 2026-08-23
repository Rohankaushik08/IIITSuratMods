import { useEffect, useState } from "react";
import api from "../src/api";
import { useAuth } from "../context/Auth";
import "./styling/Profile.css";
import { BlinkBlur } from "react-loading-indicators";
import { useNavigate } from "react-router-dom";
import { getBatchOptions } from "../src/batchOptions";

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

export default function Profile() {
  const { user, setUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const nav = useNavigate();
  const [formData, setFormData] = useState({
    username: "",
    batch: "",
    semester: ""
  });

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const response = await api.get("/auth/me");

      if (response.data.user) {
        setUser(response.data.user);
        localStorage.setItem("userProfile", JSON.stringify(response.data.user));
        setFormData({
          username: response.data.user.username,
          batch: response.data.user.batch,
          semester: response.data.user.semester
        });
      }
      setError("");
    } catch (err) {
      setError("Failed to load profile");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => {
      if (name !== "semester") return { ...previous, [name]: value };

      const options = getBatchOptions(value);
      return {
        ...previous,
        semester: value,
        batch: options.includes(previous.batch) ? previous.batch : options[0]
      };
    });
  };

  const handleLogout = () => {
    localStorage.removeItem("userToken");
    localStorage.removeItem("userProfile");
    setUser(null);
    nav("/login");
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");

      const response = await api.put("/auth/user/update", {
        username: formData.username,
        batch: formData.batch,
        semester: formData.semester
      });

      if (response.data.user) {
        setUser(response.data.user);
        localStorage.setItem("userProfile", JSON.stringify(response.data.user));
        setFormData({
          username: response.data.user.username,
          batch: response.data.user.batch,
          semester: response.data.user.semester
        });
      } else {
        await fetchUserData();
      }

      setIsEditing(false);
      setSuccess("Profile updated successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update profile");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      username: user?.username || "",
      batch: user?.batch || "",
      semester: user?.semester || ""
    });
    setIsEditing(false);
    setError("");
  };

  const extractStudentId = (email) => (email ? email.split("@")[0].toUpperCase() : "N/A");

  if (loading) {
    return (
      <div className="profile-loading">
        <p>Loading profile...</p>
        <BlinkBlur color="#C6E86B" size="medium" text="" textColor="" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="profile-page">
        <p className="profile-message">Please login to view your profile</p>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <header className="profile-header">
        <div>
          <h1>Profile</h1>
          <p>Manage your profile</p>
        </div>
      </header>

      <main className="profile-content">
        <section className="profile-card">
          <h2>Student Information</h2>
          <div className="info-grid">
            <div className="info-tile info-tile--name">
              <span className="tile-label">Name</span>
              <span className="tile-value">{user.username}</span>
            </div>

            <div className="info-tile info-tile--email">
              <span className="tile-label">Email</span>
              <span className="tile-value">{user.email}</span>
            </div>

            <div className="info-tile info-tile--id">
              <span className="tile-label">Student ID</span>
              <span className="tile-value">{extractStudentId(user.email)}</span>
            </div>

            <div className="info-tile info-tile--batch">
              <span className="tile-label">Batch</span>
              <span className="tile-value">{user.batch}</span>
            </div>

            <div className="info-tile info-tile--sem">
              <span className="tile-label">Semester</span>
              <span className="tile-value">{user.semester}</span>
            </div>

            <div className="info-tile info-tile--empty" aria-hidden="true"></div>
          </div>
        </section>

        {isEditing && (
          <section className="profile-card profile-card--edit">
            <h2>Edit Profile</h2>
            <form className="profile-form">
              <div className="form-group">
                <label>NAME</label>
                <div className="profile-input-wrapper">
                  <input type="text" name="username" value={formData.username} onChange={handleInputChange} />
                </div>
              </div>

              <div className="form-group">
                <label>SEMESTER</label>
                <div className="profile-input-wrapper">
                  <select name="semester" value={formData.semester} onChange={handleInputChange}>
                    <option value="">Select Semester</option>
                    {allowedSemesters.map((semester) => (
                      <option key={semester} value={semester}>
                        {semester}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>BATCH</label>
                <div className="profile-input-wrapper">
                  <select name="batch" value={formData.batch} onChange={handleInputChange}>
                    <option value="">Select Batch</option>
                    {/* Keep the account's current value selectable even if it predates
                        this semester's option list (e.g. a legacy "CSE 1"/"CSE 2"),
                        so the field doesn't silently show blank until re-saved. */}
                    {formData.batch && !getBatchOptions(formData.semester).includes(formData.batch) && (
                      <option value={formData.batch}>{formData.batch}</option>
                    )}
                    {getBatchOptions(formData.semester).map((batch) => (
                      <option key={batch} value={batch}>
                        {batch}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {error && <div className="error-message">{error}</div>}
              {success && <div className="success-message">{success}</div>}

              <div className="form-actions">
                <button type="button" className="save-btn" onClick={handleSave} disabled={saving}>
                  {saving ? "SAVING..." : "SAVE"}
                </button>
                <button type="button" className="cancel-btn" onClick={handleCancel} disabled={saving}>
                  CANCEL
                </button>
              </div>
            </form>
          </section>
        )}

        {!isEditing && (
          <div className="profile-actions">
            <button className="profile-btn profile-btn--edit" onClick={() => setIsEditing(true)}>
              EDIT PROFILE
            </button>
            <button className="profile-btn profile-btn--logout" onClick={handleLogout}>
              LOGOUT
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
