import express from "express";
import User from "../models/User.js";
import Appointment from "../models/Appointment.js";
import { body, param, query, validationResult } from "express-validator";

const router = express.Router();

// Helper middleware for validation
const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    res.status(400).json({ errors: errors.array() });
  };
};

// Get all doctors with pagination and filtering
router.get("/doctors", [
  validate([
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
    query("specialty").optional().trim(),
    query("available").optional().isBoolean().toBoolean()
  ])
], async (req, res) => {
  try {
    const { page = 1, limit = 10, specialty, available } = req.query;
    const skip = (page - 1) * limit;

    const filter = { role: "doctor" };
    if (specialty) filter.specialty = { $regex: specialty, $options: "i" };
    if (available) filter.availableDays = { $exists: true, $ne: [] };

    const [doctors, total] = await Promise.all([
      User.find(filter)
        .select("-password -__v")
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter)
    ]);

    res.json({
      data: doctors,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching doctors:", error);
    res.status(500).json({ 
      message: "Failed to fetch doctors",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

// Get single doctor by ID with full details
router.get("/doctors/:id", [
  validate([
    param("id").isMongoId().withMessage("Invalid doctor ID")
  ])
], async (req, res) => {
  try {
    const doctor = await User.findOne({ 
      _id: req.params.id, 
      role: "doctor" 
    }).select("-password -__v");

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    res.json(doctor);
  } catch (error) {
    console.error(`Error fetching doctor ${req.params.id}:`, error);
    res.status(500).json({ 
      message: "Failed to fetch doctor details",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

// Get all patients with pagination
router.get("/patients", [
  validate([
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt()
  ])
], async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const [patients, total] = await Promise.all([
      User.find({ role: "patient" })
        .select("-password -__v")
        .skip(skip)
        .limit(limit),
      User.countDocuments({ role: "patient" })
    ]);

    res.json({
      data: patients,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching patients:", error);
    res.status(500).json({ 
      message: "Failed to fetch patients",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

// Get single patient by ID with full details
router.get("/patients/:id", [
  validate([
    param("id").isMongoId().withMessage("Invalid patient ID")
  ])
], async (req, res) => {
  try {
    const patient = await User.findOne({ 
      _id: req.params.id, 
      role: "patient" 
    }).select("-password -__v");

    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    res.json(patient);
  } catch (error) {
    console.error(`Error fetching patient ${req.params.id}:`, error);
    res.status(500).json({ 
      message: "Failed to fetch patient details",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

// Advanced search for doctors
router.get("/doctors/search", [
  validate([
    query("query").optional().trim(),
    query("specialty").optional().trim(),
    query("availableDay").optional().isIn([
      "monday", "tuesday", "wednesday", "thursday", 
      "friday", "saturday", "sunday"
    ])
  ])
], async (req, res) => {
  try {
    const { query, specialty, availableDay } = req.query;
    
    const searchFilter = { role: "doctor" };
    
    if (query) {
      searchFilter.$or = [
        { name: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
        { specialty: { $regex: query, $options: "i" } }
      ];
    }
    
    if (specialty) {
      searchFilter.specialty = { $regex: specialty, $options: "i" };
    }
    
    if (availableDay) {
      searchFilter.availableDays = availableDay;
    }

    const doctors = await User.find(searchFilter)
      .select("-password -__v")
      .limit(50);

    res.json(doctors);
  } catch (error) {
    console.error("Doctor search error:", error);
    res.status(500).json({ 
      message: "Search failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

// Get all appointments with advanced filtering
router.get("/appointments", [
  validate([
    query("doctorId").optional().isMongoId(),
    query("patientId").optional().isMongoId(),
    query("status").optional().isIn(["pending", "confirmed", "completed", "cancelled"]),
    query("from").optional().isISO8601(),
    query("to").optional().isISO8601(),
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt()
  ])
], async (req, res) => {
  try {
    const { 
      doctorId, 
      patientId, 
      status, 
      from, 
      to, 
      page = 1, 
      limit = 10 
    } = req.query;
    
    const skip = (page - 1) * limit;
    const filter = {};
    
    if (doctorId) filter.doctorId = doctorId;
    if (patientId) filter.patientId = patientId;
    if (status) filter.status = status;
    
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }

    const [appointments, total] = await Promise.all([
      Appointment.find(filter)
        .populate("doctorId", "name specialty")
        .populate("patientId", "name email phone")
        .sort({ date: 1 })
        .skip(skip)
        .limit(limit),
      Appointment.countDocuments(filter)
    ]);

    res.json({
      data: appointments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching appointments:", error);
    res.status(500).json({ 
      message: "Failed to fetch appointments",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

// Delete doctor by ID
router.delete("/doctors/:id", [
  validate([
    param("id").isMongoId().withMessage("Invalid doctor ID")
  ])
], async (req, res) => {
  try {
    // First check if doctor has any upcoming appointments
    const hasAppointments = await Appointment.exists({ 
      doctorId: req.params.id,
      date: { $gte: new Date() },
      status: { $in: ["pending", "confirmed"] }
    });

    if (hasAppointments) {
      return res.status(400).json({ 
        message: "Cannot delete doctor with upcoming appointments" 
      });
    }

    const deletedDoctor = await User.findOneAndDelete({ 
      _id: req.params.id, 
      role: "doctor" 
    });

    if (!deletedDoctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    // Clean up related appointments
    await Appointment.deleteMany({ doctorId: req.params.id });

    res.json({ 
      message: "Doctor deleted successfully",
      deletedCount: 1
    });
  } catch (error) {
    console.error(`Error deleting doctor ${req.params.id}:`, error);
    res.status(500).json({ 
      message: "Failed to delete doctor",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

// Delete patient by ID
router.delete("/patients/:id", [
  validate([
    param("id").isMongoId().withMessage("Invalid patient ID")
  ])
], async (req, res) => {
  try {
    // Check if patient has any upcoming appointments
    const hasAppointments = await Appointment.exists({ 
      patientId: req.params.id,
      date: { $gte: new Date() },
      status: { $in: ["pending", "confirmed"] }
    });

    if (hasAppointments) {
      return res.status(400).json({ 
        message: "Cannot delete patient with upcoming appointments" 
      });
    }

    const deletedPatient = await User.findOneAndDelete({ 
      _id: req.params.id, 
      role: "patient" 
    });

    if (!deletedPatient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    // Clean up related appointments
    await Appointment.deleteMany({ patientId: req.params.id });

    res.json({ 
      message: "Patient deleted successfully",
      deletedCount: 1
    });
  } catch (error) {
    console.error(`Error deleting patient ${req.params.id}:`, error);
    res.status(500).json({ 
      message: "Failed to delete patient",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

// Delete appointment by ID
router.delete("/appointments/:id", [
  validate([
    param("id").isMongoId().withMessage("Invalid appointment ID")
  ])
], async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    // Prevent deletion of appointments that have already occurred
    if (new Date(appointment.date) < new Date() && appointment.status !== "cancelled") {
      return res.status(400).json({ 
        message: "Cannot delete past appointments that weren't cancelled" 
      });
    }

    const deletedAppointment = await Appointment.findByIdAndDelete(req.params.id);

    res.json({ 
      message: "Appointment deleted successfully",
      deletedAppointment
    });
  } catch (error) {
    console.error(`Error deleting appointment ${req.params.id}:`, error);
    res.status(500).json({ 
      message: "Failed to delete appointment",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

export default router;
