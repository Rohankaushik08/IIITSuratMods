import './App.css'
import { Route, Routes, NavLink} from 'react-router-dom'
import Admin from '../components/Admin'
import Login from '../components/Login'
import Profile from '../components/Profile'
import TimeTable from '../components/TimeTable'
import Home from '../components/Home'
import DashBoard from '../components/DashBoard'
import CourseCard from '../components/CourseCard'
import Material from '../components/Material'
function App() {
  return (
    <>
      <div className="webpage">
        <aside className="navbar">
          <div id="head">
            <h1>IIITSuratMods</h1>
            <h3>College PORTAL</h3>
          </div>
          <ul>
            <li><NavLink to="/login" style={{ textDecoration: "none", color: "inherit" }} >Login</NavLink></li>
            <li><NavLink to="/profile" style={{ textDecoration: "none", color: "inherit" }}>Profile</NavLink></li>
            <li><NavLink to="/dashboard" style={{ textDecoration: "none", color: "inherit" }}>DashBoard</NavLink></li>
            <li><NavLink to="/timetable" style={{ textDecoration: "none", color: "inherit" }}>TimeTable</NavLink></li>
            <li><NavLink to="/coursecard" style={{ textDecoration: "none", color: "inherit" }}>Course-Card</NavLink></li>
            <li><NavLink to="/material" style={{ textDecoration: "none", color: "inherit" }}>Materials</NavLink></li>
            <li><NavLink to="/admin" style={{ textDecoration: "none", color: "inherit" }}>Admin</NavLink></li>
          </ul>
        </aside>
        <main className="main-content">
          <Routes>
            <Route path='/admin' element={<Admin />} />
            <Route path='/profile' element={<Profile />} />
            <Route path='/login' element={<Login />} />
            <Route path='/timetable' element={<TimeTable year={"2025-26"} semester={"2nd"} section={"Cse 2"} />} />
            <Route path='/dashboard' element={<DashBoard />} />
            <Route path='/material' element={<Material />} />
            <Route path='/coursecard' element={<CourseCard />} />
            <Route path='*' element={<Home />} />
          </Routes>
        </main>
      </div>
    </>
  )
}

export default App
