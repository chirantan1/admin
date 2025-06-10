const Appointment = require("../models/Appointment");
const Doctor = require("../models/Doctor");
const Patient = require("../models/Patient");
const createError = require('http-errors');
const { isValidObjectId } = require('mongoose');

// Helper function for handling controller errors
const handleControllerError = (res, error) => {
  console.error('Controller Error:', error);
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: error.errors
    });
  }

  if (error instanceof createError.HttpError) {
    return res.status(error.status).json({
      success: false,
      message: error.message
    });
  }

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { error: error.message })
  });
};

/**
 * @desc Get all appointments with filtering, sorting and pagination
 * @route GET /api/appointments
 * @access Private/Admin
 */
exports.getAllAppointments = async (req, res) => {
  try {
    // Extract query parameters
    const { 
      page = 1, 
      limit = 10, 
      status, 
      doctorId, 
      patientId,
      fromDate,
      toDate,
      sortBy = 'date',
      sortOrder = 'asc'
    } = req.query;

    // Build filter object
    const filter = {};
    if (status) filter.status = status;
    if (doctorId && isValidObjectId(doctorId)) filter.doctorId = doctorId;
    if (patientId && isValidObjectId(patientId)) filter.patientId = patientId;
    
    // Date range filtering
    if (fromDate || toDate) {
      filter.date = {};
      if (fromDate) filter.date.$gte = new Date(fromDate);
      if (toDate) filter.date.$lte = new Date(toDate);
    }

    // Sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const [appointments, total] = await Promise.all([
      Appointment.find(filter)
        .populate("doctorId", "name specialty")
        .populate("patientId", "name email phone")
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Appointment.countDocuments(filter)
    ]);

    // Format response
    const formattedAppointments = appointments.map(appt => ({
      _id: appt._id,
      date: appt.date,
      status: appt.status,
      doctor: {
        id: appt.doctorId?._id,
        name: appt.doctorId?.name || 'N/A',
        specialty: appt.doctorId?.specialty || 'N/A'
      },
      patient: {
        id: appt.patientId?._id,
        name: appt.patientId?.name || 'N/A',
        email: appt.patientId?.email || 'N/A'
      },
      createdAt: appt.createdAt
    }));

    res.json({
      success: true,
      data: formattedAppointments,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    handleControllerError(res, error);
  }
};

/**
 * @desc Get single appointment by ID
 * @route GET /api/appointments/:id
 * @access Private/Admin
 */
exports.getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      throw createError(400, 'Invalid appointment ID');
    }

    const appointment = await Appointment.findById(id)
      .populate("doctorId", "name specialty email")
      .populate("patientId", "name email phone")
      .lean();

    if (!appointment) {
      throw createError(404, 'Appointment not found');
    }

    res.json({
      success: true,
      data: {
        ...appointment,
        doctor: {
          id: appointment.doctorId._id,
          name: appointment.doctorId.name,
          specialty: appointment.doctorId.specialty,
          email: appointment.doctorId.email
        },
        patient: {
          id: appointment.patientId._id,
          name: appointment.patientId.name,
          email: appointment.patientId.email,
          phone: appointment.patientId.phone
        }
      }
    });

  } catch (error) {
    handleControllerError(res, error);
  }
};

/**
 * @desc Update appointment status
 * @route PATCH /api/appointments/:id/status
 * @access Private/Admin
 */
exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!isValidObjectId(id)) {
      throw createError(400, 'Invalid appointment ID');
    }

    // Validate status value
    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed', 'no-show'];
    if (!validStatuses.includes(status)) {
      throw createError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Check if appointment exists
    const appointment = await Appointment.findById(id);
    if (!appointment) {
      throw createError(404, 'Appointment not found');
    }

    // Additional validation for status changes
    if (appointment.status === 'cancelled' && status !== 'cancelled') {
      throw createError(400, 'Cannot change status from cancelled');
    }

    if (appointment.date < new Date() && !['completed', 'no-show'].includes(status)) {
      throw createError(400, 'Past appointments can only be marked as completed or no-show');
    }

    // Update status
    appointment.status = status;
    appointment.updatedBy = req.user.id; // Track who made the change
    await appointment.save();

    res.json({
      success: true,
      message: 'Appointment status updated successfully',
      data: {
        id: appointment._id,
        previousStatus: appointment.status,
        newStatus: status,
        updatedAt: appointment.updatedAt
      }
    });

  } catch (error) {
    handleControllerError(res, error);
  }
};

/**
 * @desc Create a new appointment
 * @route POST /api/appointments
 * @access Private/Admin
 */
exports.createAppointment = async (req, res) => {
  try {
    const { doctorId, patientId, date, reason } = req.body;

    // Basic validation
    if (!isValidObjectId(doctorId) || !isValidObjectId(patientId)) {
      throw createError(400, 'Invalid doctor or patient ID');
    }

    if (!date || new Date(date) < new Date()) {
      throw createError(400, 'Valid future date is required');
    }

    // Check if doctor and patient exist
    const [doctor, patient] = await Promise.all([
      Doctor.findById(doctorId),
      Patient.findById(patientId)
    ]);

    if (!doctor) throw createError(404, 'Doctor not found');
    if (!patient) throw createError(404, 'Patient not found');

    // Check doctor availability
    const existingAppointment = await Appointment.findOne({
      doctorId,
      date: { $lte: new Date(new Date(date).getTime() + 30 * 60000) }, // 30 min after
      endTime: { $gte: date }, // Calculated end time
      status: { $in: ['pending', 'confirmed'] }
    });

    if (existingAppointment) {
      throw createError(400, 'Doctor already has an appointment at this time');
    }

    // Create appointment
    const appointment = new Appointment({
      doctorId,
      patientId,
      date,
      endTime: new Date(new Date(date).getTime() + 30 * 60000), // 30 min duration
      reason,
      createdBy: req.user.id
    });

    await appointment.save();

    // Populate the references for the response
    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('doctorId', 'name specialty')
      .populate('patientId', 'name email');

    res.status(201).json({
      success: true,
      message: 'Appointment created successfully',
      data: populatedAppointment
    });

  } catch (error) {
    handleControllerError(res, error);
  }
};

/**
 * @desc Delete an appointment
 * @route DELETE /api/appointments/:id
 * @access Private/Admin
 */
exports.deleteAppointment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      throw createError(400, 'Invalid appointment ID');
    }

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      throw createError(404, 'Appointment not found');
    }

    // Prevent deletion of past appointments unless they're cancelled
    if (appointment.date < new Date() && appointment.status !== 'cancelled') {
      throw createError(400, 'Cannot delete past appointments unless they are cancelled');
    }

    await appointment.remove();

    res.json({
      success: true,
      message: 'Appointment deleted successfully',
      data: { id }
    });

  } catch (error) {
    handleControllerError(res, error);
  }
};