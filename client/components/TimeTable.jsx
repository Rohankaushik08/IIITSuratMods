import './styling/timetable.css'
import { weeklyTimetableMock } from '../MockData/WeeklyTimeTable';
import { coursesLookup } from '../MockData/WeeklyTimeTable';
export default function TimeTable(props) {
  const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const data = weeklyTimetableMock
  const courseData = coursesLookup
  return (
    <div id="mainbox">
      <div id="thead">
        <h1>Weekly Timetable</h1>
        <h3>Academic Year {props.year} | Semester {props.semester} | {props.section}</h3>
      </div>
      <div className='tablebox'>
        <table>
          <tr>
            <th colSpan={2}>TIME</th>
            {days.map(today => <td className='first-row' colSpan={3}>{today}</td>)}
          </tr>
          {data.map((curr => {
            return (
              curr.isBreak?<tr><th className='spcftr' colSpan={20}>{curr.label}</th></tr>:
              <tr>
                <th colSpan={2}>{curr.timeSlot}</th>
                {curr.schedule.map((data) => {
                  return (
                    data === null ? <td colSpan={3}></td> : <td id='course-data' colSpan={3}>{data}
                    <br></br>
                    <span className='title'>{courseData[data] && courseData[data].title}</span>
                    <br></br>
                    <span className='room'>{courseData[data] && courseData[data].room}</span>
                    </td>
                  )
                })}
              </tr>
            )
          }))}
        </table>
      </div>
    </div>
  )
}
