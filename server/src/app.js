//all the code+comments written are cross verified with the documentation ; if u have any suggestions for improvement please let me know :)
import express from "express";
import cors from "cors";
//cors allows frontend and backend to talk when they run on different ports.



import authRoutes from "./routes/auth.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import timetableRoutes from "./routes/timetable.routes.js";

const app = express();//creates a web server API
//Middleware is code that runs during a request before the final route handler.
app.use(express.json());// adds middleware to parse incoming JSON requests. This allows the server to understand and process JSON data sent in the body of HTTP requests, making it easier to handle API requests that contain JSON payloads.

//cors(...)` creates a middleware function.
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true//allows cookies and auth headers to be sent in cross-origin requests, which is essential for maintaining user sessions and authentication when the frontend and backend are hosted on different domains or ports.
  })
);

//app.get` creates a route for HTTP GET requests.
// req,req- 1st request contains data from the client , 2nd response is what the server sends back to the client
app.get("/", (req, res) => {// iis the function that runs when someone visits the path
  res.json({ message: "IIIT Surat MOD backend is running" });//back to the client
});

app.use("/api/auth", authRoutes);//request, den it to authroutes 
app.use("/api/profile", profileRoutes);
app.use("/api/timetable", timetableRoutes);
// Only auth routes are mounted right now because this backend folder currently
// contains only the login/register files. Adding routes before their files
// exist makes Node crash before login can run.

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.statusCode || 500).json({
    message: err.message || "Server error"
  });
});

export default app;
