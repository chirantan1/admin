import express from "express";
import User from "../models/User.js";
import Appointment from "../models/Appointment.js";
import { body, param, query, validationResult } from "express-validator";
import createError from 'http-errors'; // Import http-errors for standardized error objects

const router = express.Router();

// --- Helper Functions ---

// Helper middleware for validation
const validate = (validations) => {
  return async (req, res, next) => {
    // Run all validations in parallel
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next(); // No validation errors, proceed to the next middleware/route handler
    }

    // If there are validation errors, return a 400 response
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  };
};

// Generic error handler for controllers
const handleControllerError = (res, error, customMessage = "An unexpected error occurred") => {
  console.error('Controller Error:', error); // Log the full error for debugging

  if (error.name === 'ValidationError') {
    // Mongoose validation errors
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: error.errors
    });
  }

  if (error instanceof createError.HttpError) {
    // Custom HTTP errors (e.g., 400, 404) created with http-errors
    return res.status(error.status).json({
      success: false,
      message: error.message
    });
  }

  // Generic internal server error
  res.status(500).json({
    success: false,
    message: customMessage, // Use a more user-friendly message for 500 errors
    ...(process.env.NODE_ENV === 'development' && { error: error.message }) // Include detailed error in development
  });
};

// --- Doctor Routes ---

/**
 * @route GET /api/admin/doctors
 * @desc Get all doctors with pagination and filtering
 * @access Private (Admin only, potentially needs auth middleware)
 */
router.get("/doctors", [
  validate([
    query("page").optional().isInt({ min: 1 }).toInt().withMessage("Page must be a positive integer."),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt().withMessage("Limit must be between 1 and 100."),
    query("specialty").optional().trim().escape().withMessage("Specialty must be a string."),
    query("availableToday").optional().isBoolean().toBoolean().withMessage("AvailableToday must be a boolean."),
    // Fix applied here: Add .isString() before .isIn()
    query("availableDay")
      .optional()
      .isString().withMessage("AvailableDay must be a string.") // Ensures input is a string before isIn check
      .isIn(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"])
      .withMessage("AvailableDay must be a valid day of the week."),
  ])
], async (req, res) => {
  try {
    const { page = 1, limit = 10, specialty, availableToday, availableDay } = req.query;
    const skip = (page - 1) * limit;

    const filter = { role: "doctor", isActive: true }; // Only fetch active doctors
    if (specialty) filter.specialty = { $regex: specialty, $options: "i" };

    if (availableToday) {
      // Get current day of the week (0 for Sunday, 1 for Monday, etc.)
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      filter.availableDays = today;
    } else if (availableDay) {
      filter.availableDays = availableDay.toLowerCase();
    }

    const [doctors, total] = await Promise.all([
      User.find(filter)
        .select("-password -__v") // Exclude sensitive/internal fields
        .skip(skip)
        .limit(limit)
        .sort({ name: 1 }), // Sort doctors alphabetically by name
      User.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      message: "Doctors fetched successfully",
      data: doctors,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    handleControllerError(res, error, "Failed to fetch doctors.");
  }
});

/**
 * @route GET /api/admin/doctors/:id
 * @desc Get single doctor by ID with full details
 * @access Private (Admin only, potentially needs auth middleware)
 */
router.get("/doctors/:id", [
  validate([
    param("id").isMongoId().withMessage("Invalid doctor ID format.")
  ])
], async (req, res) => {
  try {
    const doctor = await User.findOne({
      _id: req.params.id,
      role: "doctor",
      isActive: true // Ensure only active doctors are fetched
    }).select("-password -__v"); // Exclude sensitive/internal fields

    if (!doctor) {
      throw createError(404, "Doctor not found.");
    }

    res.status(200).json({
      success: true,
      message: "Doctor details fetched successfully",
      data: doctor
    });
  } catch (error) {
    handleControllerError(res, error, `Failed to fetch doctor ${req.params.id}.`);
  }
});

/**
 * @route DELETE /api/admin/doctors/:id
 * @desc Delete doctor by ID
 * @access Private (Admin only, potentially needs auth middleware)
 */
router.delete("/doctors/:id", [
  validate([
    param("id").isMongoId().withMessage("Invalid doctor ID format.")
  ])
], async (req, res) => {
  try {
    const doctorId = req.params.id;

    // Check if the doctor has any future or active appointments
    const activeAppointments = await Appointment.countDocuments({
      doctorId: doctorId,
      date: { $gte: new Date() }, // Appointments from now into the future
      status: { $in: ["pending", "confirmed"] } // Only pending or confirmed appointments
    });

    if (activeAppointments > 0) {
      throw createError(400, "Cannot delete doctor: they have upcoming pending or confirmed appointments. Please cancel them first.");
    }

    const deletedDoctor = await User.findOneAndDelete({
      _id: doctorId,
      role: "doctor"
    });

    if (!deletedDoctor) {
      throw createError(404, "Doctor not found or already deleted.");
    }

    // Optionally, update related appointments instead of deleting them.
    // For example, set doctorId to null or set status to 'cancelled' if applicable.
    // For now, mirroring your existing logic to delete associated past/cancelled appointments.
    await Appointment.deleteMany({ doctorId: doctorId }); // Deletes all appointments related to the doctor

    res.status(200).json({
      success: true,
      message: "Doctor and associated appointments deleted successfully.",
      data: { id: doctorId, name: deletedDoctor.name }
    });
  } catch (error) {
    handleControllerError(res, error, `Failed to delete doctor ${req.params.id}.`);
  }
});

// --- Patient Routes ---

/**
 * @route GET /api/admin/patients
 * @desc Get all patients with pagination
 * @access Private (Admin only, potentially needs auth middleware)
 */
router.get("/patients", [
  validate([
    query("page").optional().isInt({ min: 1 }).toInt().withMessage("Page must be a positive integer."),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt().withMessage("Limit must be between 1 and 100."),
    query("search").optional().trim().escape().withMessage("Search query must be a string."), // Added search
  ])
], async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const skip = (page - 1) * limit;

    const filter = { role: "patient", isActive: true }; // Only fetch active patients

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } }
      ];
    }

    const [patients, total] = await Promise.all([
      User.find(filter)
        .select("-password -__v")
        .skip(skip)
        .limit(limit)
        .sort({ name: 1 }), // Sort patients alphabetically by name
      User.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      message: "Patients fetched successfully",
      data: patients,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    handleControllerError(res, error, "Failed to fetch patients.");
  }
});

/**
 * @route GET /api/admin/patients/:id
 * @desc Get single patient by ID with full details
 * @access Private (Admin only, potentially needs auth middleware)
 */
router.get("/patients/:id", [
  validate([
    param("id").isMongoId().withMessage("Invalid patient ID format.")
  ])
], async (req, res) => {
  try {
    const patient = await User.findOne({
      _id: req.params.id,
      role: "patient",
      isActive: true // Ensure only active patients are fetched
    }).select("-password -__v");

    if (!patient) {
      throw createError(404, "Patient not found.");
    }

    res.status(200).json({
      success: true,
      message: "Patient details fetched successfully",
      data: patient
    });
  } catch (error) {
    handleControllerError(res, error, `Failed to fetch patient ${req.params.id}.`);
  }
});

/**
 * @route DELETE /api/admin/patients/:id
 * @desc Delete patient by ID
 * @access Private (Admin only, potentially needs auth middleware)
 */
router.delete("/patients/:id", [
  validate([
    param("id").isMongoId().withMessage("Invalid patient ID format.")
  ])
], async (req, res) => {
  try {
    const patientId = req.params.id;

    // Check if the patient has any future or active appointments
    const activeAppointments = await Appointment.countDocuments({
      patientId: patientId,
      date: { $gte: new Date() },
      status: { $in: ["pending", "confirmed"] }
    });

    if (activeAppointments > 0) {
      throw createError(400, "Cannot delete patient: they have upcoming pending or confirmed appointments. Please cancel them first.");
    }

    const deletedPatient = await User.findOneAndDelete({
      _id: patientId,
      role: "patient"
    });

    if (!deletedPatient) {
      throw createError(404, "Patient not found or already deleted.");
    }

    // Delete all appointments related to the patient (past, completed, cancelled)
    await Appointment.deleteMany({ patientId: patientId });

    res.status(200).json({
      success: true,
      message: "Patient and associated appointments deleted successfully.",
      data: { id: patientId, name: deletedPatient.name }
    });
  } catch (error) {
    handleControllerError(res, error, `Failed to delete patient ${req.params.id}.`);
  }
});

// --- Advanced Search for Doctors ---
// This route is a bit redundant given the robust filtering in /doctors,
// but can be kept if a separate "quick search" endpoint is desired.
// I've incorporated the search query into the main /doctors route for better consolidation.
// Keeping this as a separate route if you specifically want '/doctors/search'
/**
 * @route GET /api/admin/doctors/search
 * @desc Advanced search for doctors
 * @access Private (Admin only, potentially needs auth middleware)
 * @deprecated Consider merging with GET /api/admin/doctors for more flexible filtering.
 */
router.get("/doctors/search", [
  validate([
    query("query").optional().trim().escape().withMessage("Search query must be a string."),
    query("specialty").optional().trim().escape().withMessage("Specialty must be a string."),
    // Fix applied here: Add .isString() before .isIn()
    query("availableDay")
      .optional()
      .isString().withMessage("AvailableDay must be a string.") // Ensures input is a string before isIn check
      .isIn([
        "monday", "tuesday", "wednesday", "thursday",
        "friday", "saturday", "sunday"
      ]).withMessage("AvailableDay must be a valid day of the week."),
  ])
], async (req, res) => {
  try {
    const { query: searchQuery, specialty, availableDay } = req.query; // Renamed 'query' to 'searchQuery' to avoid conflict

    const filter = { role: "doctor", isActive: true };

    if (searchQuery) {
      filter.$or = [
        { name: { $regex: searchQuery, $options: "i" } },
        { email: { $regex: searchQuery, $options: "i" } },
        // Add other fields you might want to search on
        { specialty: { $regex: searchQuery, $options: "i" } } // Include specialty in general search
      ];
    }

    // Combine with specific filters
    if (specialty) {
      filter.specialty = { $regex: specialty, $options: "i" };
    }

    if (availableDay) {
      filter.availableDays = availableDay.toLowerCase();
    }

    const doctors = await User.find(filter)
      .select("-password -__v")
      .limit(50) // Limit search results to prevent overwhelming responses
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      message: "Doctor search completed.",
      data: doctors
    });
  } catch (error) {
    handleControllerError(res, error, "Doctor search failed.");
  }
});

// --- Appointment Routes ---

/**
 * @route GET /api/admin/appointments
 * @desc Get all appointments with advanced filtering and pagination
 * @access Private (Admin only, potentially needs auth middleware)
 */
router.get("/appointments", [
  validate([
    query("doctorId").optional().isMongoId().withMessage("Invalid doctor ID format."),
    query("patientId").optional().isMongoId().withMessage("Invalid patient ID format."),
    query("status").optional().isIn(["pending", "confirmed", "completed", "cancelled", "no-show"])
      .withMessage("Invalid appointment status."),
    query("from").optional().isISO8601().toDate().withMessage("Invalid 'from' date format (YYYY-MM-DD)."), // Convert to Date object
    query("to").optional().isISO8601().toDate().withMessage("Invalid 'to' date format (YYYY-MM-DD)."), // Convert to Date object
    query("page").optional().isInt({ min: 1 }).toInt().withMessage("Page must be a positive integer."),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt().withMessage("Limit must be between 1 and 100.")
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
      if (from) filter.date.$gte = from; // 'from' is already a Date object due to .toDate()
      if (to) filter.date.$lte = to;     // 'to' is already a Date object due to .toDate()
    }

    const [appointments, total] = await Promise.all([
      Appointment.find(filter)
        .populate("doctorId", "name specialty email") // Populate doctor fields for dashboard display
        .populate("patientId", "name email phone")   // Populate patient fields for dashboard display
        .sort({ date: 1 }) // Sort by date ascending
        .skip(skip)
        .limit(limit),
      Appointment.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      message: "Appointments fetched successfully",
      data: appointments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    handleControllerError(res, error, "Failed to fetch appointments.");
  }
});

/**
 * @route DELETE /api/admin/appointments/:id
 * @desc Delete appointment by ID
 * @access Private (Admin only, potentially needs auth middleware)
 */
router.delete("/appointments/:id", [
  validate([
    param("id").isMongoId().withMessage("Invalid appointment ID format.")
  ])
], async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      throw createError(404, "Appointment not found.");
    }

    // Only allow deletion of appointments that are in the future OR already cancelled.
    // Past appointments that are 'completed' or 'no-show' should ideally be kept for record.
    if (new Date(appointment.date) < new Date() && appointment.status !== "cancelled") {
      throw createError(400, "Cannot delete past appointments that were not cancelled. Consider updating status to 'cancelled' if needed.");
    }

    const deletedAppointment = await Appointment.findByIdAndDelete(appointmentId);

    res.status(200).json({
      success: true,
      message: "Appointment deleted successfully.",
      data: deletedAppointment // Return the deleted document for confirmation
    });
  } catch (error) {
    handleControllerError(res, error, `Failed to delete appointment ${req.params.id}.`);
  }
});


export default router;