//all the code+comments written are cross verified with the documentation ; if u have any suggestions for improvement please let me know :)



import { useState } from "react";
import axios from "axios";//http requests to backend
import { Link, useNavigate } from "react-router-dom";
import "./styling/Login.css";

const API_URL = "http://localhost:5000/api/auth";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const requestCode = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await axios.post(`${API_URL}/forgot-password`, { email });
      setCodeRequested(true);
      setMessage(response.data.message);
    } catch (err) {
      setError(err.response?.data?.message || "Could not send a reset code.");
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/reset-password`, { email, otp, password });
      setMessage(response.data.message);
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setError(err.response?.data?.message || "Could not reset the password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="portal-container">
      <div className="portal-header">
        <h1>IIITSuratMods</h1>
        <p>Reset your password</p>
      </div>

      <div className="login-card">
        <form onSubmit={codeRequested ? changePassword : requestCode}>
          <div className="input-group">
            <label>COLLEGE EMAIL</label>
            <div className="input-wrapper">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="student@college.edu"
                required
                disabled={codeRequested}
              />
            </div>
          </div>

          {codeRequested && (
            <>
              <div className="input-group">
                <label>6-DIGIT RESET CODE</label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength="6"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label>NEW PASSWORD</label>
                <div className="input-wrapper">
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength="8" required />
                </div>
              </div>

              <div className="input-group">
                <label>CONFIRM NEW PASSWORD</label>
                <div className="input-wrapper">
                  <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength="8" required />
                </div>
              </div>
            </>
          )}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "PLEASE WAIT..." : codeRequested ? "RESET PASSWORD" : "SEND RESET CODE"}
          </button>
        </form>

        {codeRequested && <button type="button" className="text-button" onClick={requestCode} disabled={loading}>Resend code</button>}
        {message && <p className="auth-message auth-success">{message}</p>}
        {error && <p className="auth-message auth-error">{error}</p>}

        <div className="signup-text"><Link to="/login">Back to login</Link></div>
      </div>
    </div>
  );
}
