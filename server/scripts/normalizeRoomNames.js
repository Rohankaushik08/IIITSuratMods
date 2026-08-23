import "dotenv/config";
import mongoose from "mongoose";
import ClassSchedule from "../src/models/ClassSchedule.js";
import { FIXED_VENUES } from "../src/data/venues.js";
import { normalizeRoomName } from "../src/utils/normalizeRoom.js";

if (!process.env.MONGO_URI) {
  console.error("MONGO_URI is missing in .env");
  process.exit(1);
}

try {
  await mongoose.connect(process.env.MONGO_URI);

  const canonicalByKey = new Map(FIXED_VENUES.map((v) => [normalizeRoomName(v.name), v.name]));

  for (const raw of await ClassSchedule.distinct("roomNo")) {
    const canonical = canonicalByKey.get(normalizeRoomName(raw));
    if (canonical && canonical !== raw) {
      const { modifiedCount } = await ClassSchedule.updateMany({ roomNo: raw }, { $set: { roomNo: canonical } });
      console.log(`"${raw}" -> "${canonical}" (${modifiedCount} docs)`);
    } else if (!canonical) {
      console.warn(`No canonical match for "${raw}" — check manually.`);
    }
  }
} catch (error) {
  console.error("Normalization failed:", error.message);
  process.exit(1);
} finally {
  await mongoose.disconnect();
}
