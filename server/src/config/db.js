import mongoose from "mongoose";

let cached = global._mongoose;
if (!cached) {
  cached = global._mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  if (cached.conn) {
    return cached.conn; // warm invocation: reuse existing connection
  }

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing in .env");
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(process.env.MONGO_URI, {
        bufferCommands: false, // fail fast instead of hanging queries for 10s
        serverSelectionTimeoutMS: 5000, // fail in 5s, not the driver's default 30s
      })
      .then((m) => {
        console.log(`MongoDB connected: ${m.connection.host}`);
        return m;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null; // let the next request retry instead of staying broken
    console.error(`MongoDB connection failed: ${error.message}`);
    throw error; // never process.exit() here — let the route handler return a proper HTTP error
  }

  return cached.conn;
};

export default connectDB;