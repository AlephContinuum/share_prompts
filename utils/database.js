import mongoose from "mongoose";

mongoose.set("strictQuery", true);

// Reuse one connection across requests (and across hot reloads in dev).
let connecting = null;

export const connectToDB = async () => {
  // 1 = connected. Checking the live state (not a saved flag) means a dropped
  // connection gets re-opened on the next request instead of hanging.
  if (mongoose.connection.readyState === 1) return;

  if (!connecting) {
    connecting = mongoose
      .connect(process.env.MONGODB_URI, {
        dbName: "share_prompts",
        serverSelectionTimeoutMS: 10000,
      })
      .then(() => console.log("MongoDB connected"))
      .catch((error) => {
        console.error("MongoDB connection error:", error.message);
        throw error;
      })
      .finally(() => {
        connecting = null;
      });
  }
  await connecting;
};

export default connectToDB;
