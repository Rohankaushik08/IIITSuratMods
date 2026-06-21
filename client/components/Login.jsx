//all the code+comments written are cross verified with the documentation ; if u have any suggestions for improvement please let me know :)


import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/Auth";
import "./styling/Login.css";
import { useNavigate, Link } from "react-router-dom";
import {BlinkBlur}  from 'react-loading-indicators';

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { user,setUser } = useAuth();
  const nav = useNavigate();
  useEffect(()=>{
    const savedProfile = localStorage.getItem("userProfile");
    if(user || savedProfile){
      nav("/dashboard")
    }
  },[user])
  const [loading,setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNeedsVerification(false);
    try {
      // Express login expects a POST request with email and password in the request body.
      // The full backend route is: POST http://localhost:5000/api/auth/login
      const response = await axios.post("http://localhost:5000/api/auth/login", {
        email,
        password
      });
      
      // Backend returns an object like: { message, user, token }
      // So we read response.data.token and response.data.user directly.
      if (response.data?.token && response.data?.user) {
        localStorage.setItem("userToken", response.data.token);
        localStorage.setItem("userProfile", JSON.stringify(response.data.user));
        setUser(response.data.user);
        nav("/dashboard");
      } else {
        setError("Login response was incomplete. Please try again.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Please try again.");
      setNeedsVerification(Boolean(err.response?.data?.emailVerificationRequired));
    }
    setLoading(false)
  };

  return (
    <div className="portal-container">
      <div className="portal-header">
        <h1>IIITSuratMods</h1>
        <p>IIIT Surat Portal</p>
      </div>

      <div className="login-card">
        <form onSubmit={handleLogin}>
          
          <div className="input-group">
            <label>USERNAME</label>
            <div className="input-wrapper">
              <span className="input-icon">👤</span>
              <input 
                placeholder="College Email" 
                type="email" 
                onChange={(e) => setEmail(e.target.value)} 
                required 
              />
            </div>
          </div>

          <div className="input-group">
            <div className="label-row">
              <label>PASSWORD</label>
              <Link to="/forgot-password" className="forgot-link">Forgot?</Link>
            </div>
            <div className="input-wrapper">
              <span className="input-icon">🔒</span>
              <input 
                placeholder="••••••••" 
                type="password" 
                onChange={(e) => setPassword(e.target.value)} 
                required 
              />
            </div>
          </div>

          <button type="submit" className="login-btn">LOGIN</button>
          {error && <p className="auth-message auth-error">{error}</p>}
          {needsVerification && (
            <div className="signup-text">
              <Link to={`/verify-email?email=${encodeURIComponent(email)}`}>Verify email now</Link>
            </div>
          )}
          {loading && 
          <div id="loading-anim">
            <BlinkBlur color="#0ea5e9" size="medium" text="" textColor="" />
          </div>}

        </form>

        <div className="signup-text">
          Don't have an account? <Link to="/signup">Sign up</Link>
        </div>
      </div>
    </div>
  );
}
