//all the code+comments written are cross verified with the documentation ; if u have any suggestions for improvement please let me know :)


import { useState } from "react";
import api from "../src/api";
import "./styling/Login.css";
import { useNavigate, Link } from "react-router-dom";
import { BlinkBlur } from "react-loading-indicators";
import { getBatchOptions } from "../src/batchOptions";
export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [semester, setSemester] = useState("Semester 1");
  const [batch, setBatch] = useState(getBatchOptions("Semester 1")[0]);

  const handleSemesterChange = (value) => {
    setSemester(value);
    const options = getBatchOptions(value);
    if (!options.includes(batch)) setBatch(options[0]);
  };

  const nav = useNavigate();
  const [loading,setLoading] = useState(false);
  const [error, setError] = useState("");
  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      // Express register expects this exact shape in the request body.
      // Full route: POST {VITE_API_URL}/auth/register
      const newUserPayload = {
        name,
        email,
        batch,
        semester,
        password
      };

      const response = await api.post("/auth/register", newUserPayload);

      if (response.status === 201) {
        nav(`/verify-email?email=${encodeURIComponent(response.data.email || email)}`);
      }
    } catch (err) {
      const backendMessage = err.response?.data?.message;
      const statusText = err.response?.status ? `HTTP ${err.response.status}` : err.code || err.message;
      setError(backendMessage || `Sign up failed: ${statusText}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="portal-container">
      <div className="portal-header">
        <h1>
          IIIT<span className="gold">Surat</span><span className="teal">Mods</span>
        </h1>
        <p>Create your student account</p>
        <div className="accent-bars" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>

      <div className="login-card">
        <form onSubmit={handleSignup}>

          <div className="input-group field--name">
            <label>NAME</label>
            <div className="input-wrapper">
              <input
                placeholder="Your Full Name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group field--email">
            <label>COLLEGE EMAIL</label>
            <div className="input-wrapper">
              <input
                placeholder="student@iiitsurat.ac.in"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group field--semester">
            <label>SEMESTER</label>
            <div className="input-wrapper">
              <select
                value={semester}
                onChange={(e) => handleSemesterChange(e.target.value)}
                className="select-input"
                required
              >
                <option value="Semester 1">Semester 1</option>
                <option value="Semester 2">Semester 2</option>
                <option value="Semester 3">Semester 3</option>
                <option value="Semester 4">Semester 4</option>
                <option value="Semester 5">Semester 5</option>
                <option value="Semester 6">Semester 6</option>
                <option value="Semester 7">Semester 7</option>
                <option value="Semester 8">Semester 8</option>
              </select>
            </div>
          </div>

          <div className="input-group field--batch">
            <label>BATCH</label>
            <div className="input-wrapper">
              <select
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                className="select-input"
                required
              >
                {getBatchOptions(semester).map((option) => (
                  <option value={option} key={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="input-group field--password">
            <label>SET PASSWORD</label>
            <div className="input-wrapper">
              <input
                placeholder="At least 8 characters"
                type="password"
                minLength="8"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "CREATING ACCOUNT..." : "SIGN UP"}
          </button>
          {error && <p className="auth-message auth-error">{error}</p>}
          {loading &&
          <div id="loading-anim">
            <BlinkBlur color="#C6E86B" size="medium" text="" textColor="" />
          </div>}
        </form>

        <div className="signup-text">
          Have an account? <Link to="/login">Login</Link>
        </div>
        <div className="signup-text">
          Already received a code? <Link to="/verify-email">Verify email</Link>
        </div>
      </div>
    </div>
  );
}
