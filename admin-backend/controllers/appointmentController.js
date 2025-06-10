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
        .populate("doctorId", "name specialty") // This populates doctor details
        .populate("patientId", "name email phone") // This populates patient details
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(), // .lean() converts Mongoose documents to plain JavaScript objects
      Appointment.countDocuments(filter)
    ]);

    // Format response - This explicitly creates 'doctor' and 'patient' nested objects
    // with the populated data, which is great for your frontend.
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
        email: appt.patientId?.email || 'N/A',
        phone: appt.patientId?.phone || 'N/A' // Ensure phone is included if available in patient model
      },
      reason: appt.reason, // Include reason if it's part of the appointment model
      endTime: appt.endTime, // Include endTime if it's part of the appointment model
      createdAt: appt.createdAt,
      updatedAt: appt.updatedAt // Include if you have timestamps
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

    // Ensure the response format is consistent with getAllAppointments
    res.json({
      success: true,
      data: {
        ...appointment, // Includes original fields like _id, date, status, reason, endTime
        doctor: {
          id: appointment.doctorId?._id,
          name: appointment.doctorId?.name || 'N/A',
          specialty: appointment.doctorId?.specialty || 'N/A',
          email: appointment.doctorId?.email || 'N/A'
        },
        patient: {
          id: appointment.patientId?._id,
          name: appointment.patientId?.name || 'N/A',
          email: appointment.patientId?.email || 'N/A',
          phone: appointment.patientId?.phone || 'N/A'
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

    // Check if the appointment date is in the past
    // Note: Comparing Date objects directly can sometimes be tricky with timezones.
    // For simplicity, this assumes server and client timezones are handled or not critical.
    const now = new Date();
    if (new Date(appointment.date) < now && !['completed', 'no-show', 'cancelled'].includes(status)) {
        throw createError(400, 'Past appointments can only be marked as completed, no-show, or cancelled');
    }


    // Update status
    appointment.status = status;
    // Assuming req.user.id is set by your authentication middleware
    appointment.updatedBy = req.user?.id; 
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

    // Ensure date is valid and in the future
    const appointmentDate = new Date(date);
    const now = new Date();
    if (isNaN(appointmentDate.getTime()) || appointmentDate < now) {
      throw createError(400, 'A valid future date is required for the appointment');
    }

    // Check if doctor and patient exist
    const [doctor, patient] = await Promise.all([
      Doctor.findById(doctorId),
      Patient.findById(patientId)
    ]);

    if (!doctor) throw createError(404, 'Doctor not found');
    if (!patient) throw createError(404, 'Patient not found');

    // Define a standard appointment duration (e.g., 30 minutes)
    const APPOINTMENT_DURATION_MS = 30 * 60 * 1000; // 30 minutes in milliseconds
    const appointmentEndTime = new Date(appointmentDate.getTime() + APPOINTMENT_DURATION_MS);

    // Check for overlapping appointments for the doctor
    const existingAppointment = await Appointment.findOne({
      doctorId,
      // Check if the new appointment's time range overlaps with any existing ones
      $or: [
        { date: { $lt: appointmentEndTime, $gte: appointmentDate } }, // Existing starts within new
        { endTime: { $gt: appointmentDate, $lte: appointmentEndTime } }, // Existing ends within new
        { date: { $lte: appointmentDate }, endTime: { $gte: appointmentEndTime } } // Existing fully contains new
      ],
      status: { $in: ['pending', 'confirmed'] } // Only consider active appointments
    });

    if (existingAppointment) {
      throw createError(400, 'Doctor already has an overlapping appointment at this time.');
    }

    // Create appointment
    const appointment = new Appointment({
      doctorId,
      patientId,
      date: appointmentDate,
      endTime: appointmentEndTime, // Store the calculated end time
      reason,
      createdBy: req.user?.id // Assuming req.user.id is set by your authentication middleware
    });

    await appointment.save();

    // Populate the references for the response to send back rich data
    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('doctorId', 'name specialty email') // Add email to doctor
      .populate('patientId', 'name email phone') // Add phone to patient
      .lean();

    res.status(201).json({
      success: true,
      message: 'Appointment created successfully',
      data: {
        ...populatedAppointment,
        // Re-format for consistency with getAllAppointments if needed,
        // or just send the populated object directly if frontend handles it.
        // For now, mirroring the getAllAppointments format.
        doctor: {
            id: populatedAppointment.doctorId?._id,
            name: populatedAppointment.doctorId?.name || 'N/A',
            specialty: populatedAppointment.doctorId?.specialty || 'N/A',
            email: populatedAppointment.doctorId?.email || 'N/A'
        },
        patient: {
            id: populatedAppointment.patientId?._id,
            name: populatedAppointment.patientId?.name || 'N/A',
            email: populatedAppointment.patientId?.email || 'N/A',
            phone: populatedAppointment.patientId?.phone || 'N/A'
        }
      }
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
    const now = new Date();
    if (new Date(appointment.date) < now && appointment.status !== 'cancelled') {
      throw createError(400, 'Cannot delete past appointments unless they are already cancelled.');
    }

    // Use deleteOne or findByIdAndDelete for modern Mongoose practices
    await Appointment.deleteOne({ _id: id }); // Or await Appointment.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Appointment deleted successfully',
      data: { id }
    });

  } catch (error) {
    handleControllerError(res, error);
  }
};