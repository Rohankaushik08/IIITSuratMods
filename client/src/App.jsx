import './App.css'
import { Route, Routes, NavLink } from 'react-router-dom'
import Admin from '../components/Admin'
import Login from '../components/Login'
import Profile from '../components/Profile'
import TimeTable from '../components/TimeTable'
import Home from '../components/Home'
import DashBoard from '../components/DashBoard'
import CourseCard from '../components/CourseCard'
import Material from '../components/Material'
import { useContext, useState } from 'react'
import { useAuth } from '../context/Auth'
import SignUp from '../components/SignUp'
import { useNavigate } from 'react-router-dom'
function App() {
  const { user } = useAuth();
  const nav = useNavigate();
  function handleLogout(){
    localStorage.removeItem("userToken");
    localStorage.removeItem("userProfile");
    window.location.reload();
    nav('./login');
  }
  const [navBar,setNavBar] = useState(false);
  return (
    <>
      <div className="webpage">
        <aside className={`navbar ${navBar ? 'open' : ''}`}>
          <div id="head">
            <h1>IIITSuratMods</h1>
          </div>
          <ul onClick={()=>setNavBar(!navBar)}>
            <li>{(user === null) && <NavLink to="/login" style={{ textDecoration: "none", color: "inherit" }} >Login</NavLink>}</li>
            <li><NavLink to="/profile" style={{ textDecoration: "none", color: "inherit" }}>Profile</NavLink></li>
            <li><NavLink to="/dashboard" style={{ textDecoration: "none", color: "inherit" }}>DashBoard</NavLink></li>
            <li><NavLink to="/timetable" style={{ textDecoration: "none", color: "inherit" }}>TimeTable</NavLink></li>
            <li><NavLink to="/coursecard" style={{ textDecoration: "none", color: "inherit" }}>Course-Card</NavLink></li>
            <li><NavLink to="/material" style={{ textDecoration: "none", color: "inherit" }}>Materials</NavLink></li>
            <li><NavLink to="/admin" style={{ textDecoration: "none", color: "inherit" }}>Admin</NavLink></li>
            {user &&<li><div className="action-box">
            <button className="logout-btn" onClick={handleLogout}>Logout</button>
          </div></li>}
          </ul>
        </aside>
        <main className="main-content">
          <button
            className="menu-toggle-btn"
            onClick={() => setNavBar(!navBar)}
            style={{ margin: '10px', padding: '8px 16px' }}
          >
            {navBar ? '✕' : '☰'}
          </button>
          <Routes>
            <Route path='/admin' element={<Admin />} />
            <Route path='/profile' element={<Profile />} />
            <Route path='/login' element={<Login />} />
            <Route path='/timetable' element={<TimeTable year={"2025-26"} semester={"2nd"} section={"Cse 2"} />} />
            <Route path='/dashboard' element={<DashBoard />} />
            <Route path='/material' element={<Material />} />
            <Route path='/coursecard' element={<CourseCard />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path='*' element={<Login />} />
          </Routes>
        </main>
      </div>
    </>
  )
}

export default App
