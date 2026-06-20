import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/Auth";
import "./styling/Profile.css";
import {BlinkBlur}  from 'react-loading-indicators';
import { useNavigate } from "react-router-dom";
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

export default function Profile() {
  const { user, setUser } = useAuth(); // current logged in user
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

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("userToken");
      const response = await axios.get("http://localhost:5000/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.user) {
        setUser(response.data.user);
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  function handleLogout(){
    localStorage.removeItem("userToken");
    localStorage.removeItem("userProfile");
    window.location.reload();
    nav('./login');
  }

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      
      const token = localStorage.getItem("userToken");
      const userId = user._id;

      await axios.put(
        `http://localhost:5000/api/auth/user/update`, // update api
        {
          username: formData.username,
          batch: formData.batch,
          semester: formData.semester
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      await fetchUserData();
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

  const extractStudentId = (email) => {
    return email ? email.split("@")[0].toUpperCase() : "N/A";
  };

  if (loading) {
    return <div className="loading-container">
            <p>Loading profile...</p>
            <BlinkBlur color="#0ea5e9" size="medium" text="" textColor="" />
          </div>;
  }

  if (!user) {
    return <div className="profile-container"><p>Please login to view your profile</p></div>;
  }

  return (
    <div id="mainbox">
      <div className="profile-header">
        <h1>Profile</h1>
        <p>Manage your profile</p>
      </div>

      <div className="profile-content">
        {/* Info Section */}
        <div className="info-box">
          <h2>Student Information</h2><br/>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Name</span>
              <span className="info-value">{user.username}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Email</span>
              <span className="info-value">{user.email}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Student ID</span>
              <span className="info-value">{extractStudentId(user.email)}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Batch</span>
              <span className="info-value">{user.batch}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Semester</span>
              <span className="info-value">{user.semester}</span>
            </div>
          </div>
        </div>

        {/* Edit Form Section */}
        {isEditing && (
          <div className="info-box">
            <h2>Edit Profile</h2><br/>
            <form className="profile-form">
              <div className="form-group">
                <label>NAME</label>
                <div className="input-wrapper">
                  <span className="input-icon">👤</span>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>BATCH</label>
                <div className="input-wrapper">
                  <select
                    name="batch"
                    value={formData.batch}
                    onChange={handleInputChange}
                  >
                    <option value="">Select Batch</option>
                    {allowedBatches.map(batch => (
                      <option key={batch} value={batch}>{batch}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>SEMESTER</label>
                <div className="input-wrapper">
                  <select
                    name="semester"
                    value={formData.semester}
                    onChange={handleInputChange}
                  >
                    <option value="">Select Semester</option>
                    {allowedSemesters.map(sem => (
                      <option key={sem} value={sem}>{sem}</option>
                    ))}
                  </select>
                </div>
              </div>

              {error && <div className="error-message">{error}</div>}
              {success && <div className="success-message">{success}</div>}

              <div className="form-actions">
                <button
                  type="button"
                  className="save-btn"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "SAVING..." : "SAVE"}
                </button>
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={handleCancel}
                  disabled={saving}
                >
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Edit Profile Button */}
        {!isEditing && (
          <>
          <div className="action-box">
            <button
              className="edit-btn"
              onClick={() => setIsEditing(true)}
            >
              EDIT PROFILE
            </button>
          </div>
          <div className="action-box">
            <button className="logout-btn" onClick={handleLogout}>Logout</button>
          </div>
          </>
        )}
      </div>
    </div>
  );
}