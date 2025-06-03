import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { type: String, enum: ["doctor", "patient"], required: true },
  // add other fields as needed (password, etc.)
});

const User = mongoose.model("User", userSchema);

export default User;
