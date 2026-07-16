import mongoose from "mongoose";

await mongoose.connect(process.env.MONGODB_URI, {
    dbName: "share_prompts",
});

console.log("Connected");

console.log(mongoose.connection.readyState);
console.log(mongoose.connection.name);

await mongoose.disconnect();