import express from "express";
import User from "../models/User.js";
import Appointment from "../models/Appointment.js";

const router = express.Router();

// Get all doctors
router.get("/doctors", async (req, res) => {
  try {
    const doctors = await User.find({ role: "doctor" }).select("-password");
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get all patients
router.get("/patients", async (req, res) => {
  try {
    const patients = await User.find({ role: "patient" }).select("-password");
    res.json(patients);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get all appointments
router.get("/appointments", async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate("doctorId", "name email")
      .populate("patientId", "name email");
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Search doctor by name (query param: ?name=...)
router.get("/doctors/search", async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) {
      return res.status(400).json({ message: "Name query parameter is required" });
    }
    const doctors = await User.find({
      role: "doctor",
      name: { $regex: name, $options: "i" },
    }).select("-password");
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Delete doctor by ID
router.delete("/doctors/:id", async (req, res) => {
  try {
    const deletedDoctor = await User.findOneAndDelete({ _id: req.params.id, role: "doctor" });
    if (!deletedDoctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }
    res.json({ message: "Doctor deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Delete patient by ID
router.delete("/patients/:id", async (req, res) => {
  try {
    const deletedPatient = await User.findOneAndDelete({ _id: req.params.id, role: "patient" });
    if (!deletedPatient) {
      return res.status(404).json({ message: "Patient not found" });
    }
    res.json({ message: "Patient deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Delete appointment by ID
router.delete("/appointments/:id", async (req, res) => {
  try {
    const deletedAppointment = await Appointment.findByIdAndDelete(req.params.id);
    if (!deletedAppointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }
    res.json({ message: "Appointment deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
