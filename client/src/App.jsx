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
function App() {
  const { user } = useAuth();
  const [navBar,setNavBar] = useState(true);
  return (
    <>
      <div className="webpage">
        {navBar &&
        <aside className="navbar">
          <div id="head">
            <h1>IIITSuratMods</h1>
          </div>
          <ul onClick={()=>setNavBar(false)}>
            <li>{(user === null) && <NavLink to="/login" style={{ textDecoration: "none", color: "inherit" }} >Login</NavLink>}</li>
            <li><NavLink to="/profile" style={{ textDecoration: "none", color: "inherit" }}>Profile</NavLink></li>
            <li><NavLink to="/dashboard" style={{ textDecoration: "none", color: "inherit" }}>DashBoard</NavLink></li>
            <li><NavLink to="/timetable" style={{ textDecoration: "none", color: "inherit" }}>TimeTable</NavLink></li>
            <li><NavLink to="/coursecard" style={{ textDecoration: "none", color: "inherit" }}>Course-Card</NavLink></li>
            <li><NavLink to="/material" style={{ textDecoration: "none", color: "inherit" }}>Materials</NavLink></li>
            <li><NavLink to="/admin" style={{ textDecoration: "none", color: "inherit" }}>Admin</NavLink></li>
          </ul>
        </aside>
}
        <main className="main-content">
          <button
            className="menu-toggle-btn"
            onClick={() => setNavBar(!navBar)}
            style={{ margin: '10px', padding: '8px 16px' }}
          >
            {navBar ? '✕ Close Menu' : '☰ Open Menu'}
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
            <Route path='*' element={<Home />} />
          </Routes>
        </main>
      </div>
    </>
  )
}

export default App
