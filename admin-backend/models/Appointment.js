import mongoose from "mongoose";
// You imported validator, but it's not currently used in the schema.
// If you plan to use it for custom string validations, keep it.
// import validator from "validator"; 

const appointmentSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // Assuming 'User' model holds both doctors and patients
    required: [true, "Doctor ID is required"],
    // Async custom validator to ensure the doctorId refers to an actual 'doctor' user
    validate: {
      validator: async function(value) {
        // 'this.model' refers to the model on which the schema is defined (Appointment)
        // To find a user, we need to explicitly get the 'User' model
        const User = mongoose.model('User');
        const doctor = await User.findOne({ _id: value, role: 'doctor' });
        return !!doctor; // Returns true if doctor exists and has role 'doctor', false otherwise
      },
      message: 'Doctor not found or the provided ID does not belong to a doctor role.'
    }
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // Assuming 'User' model holds both doctors and patients
    required: [true, "Patient ID is required"],
    // Async custom validator to ensure the patientId refers to an actual 'patient' user
    validate: {
      validator: async function(value) {
        const User = mongoose.model('User');
        const patient = await User.findOne({ _id: value, role: 'patient' });
        return !!patient; // Returns true if patient exists and has role 'patient', false otherwise
      },
      message: 'Patient not found or the provided ID does not belong to a patient role.'
    }
  },
  date: { // Represents the start time of the appointment
    type: Date,
    required: [true, "Appointment date and time is required"],
    // Validator for future date: client-side validation is helpful, but backend must enforce.
    validate: {
      validator: function(value) {
        // Using `Date.now()` for a more precise check against current time
        // Using `this.isNew` to allow saving past appointments (e.g., for data migration or history)
        // but restrict creation of new past appointments.
        if (this.isNew) {
            return value > Date.now();
        }
        return true; // Allow updates to existing appointments even if date is in past (e.g., status changes)
      },
      message: 'Appointment date and time must be in the future for new appointments.'
    }
  },
  endTime: { // Represents the end time of the appointment
    type: Date,
    required: [true, "Appointment end time is required"],
    validate: {
      validator: function(value) {
        // Ensure endTime is strictly after date (start time)
        return value > this.date;
      },
      message: 'End time must be after the start time of the appointment.'
    }
  },
  status: {
    type: String,
    enum: {
      values: ["pending", "confirmed", "completed", "cancelled", "no-show"],
      message: 'Status must be one of: pending, confirmed, completed, cancelled, or no-show.'
    },
    default: "pending",
    lowercase: true, // Store status in lowercase for consistency
    trim: true
  },
  reason: {
    type: String,
    trim: true,
    maxlength: [500, 'Reason cannot be longer than 500 characters.']
  },
  symptoms: {
    type: [String],
    // Custom validator for array length
    validate: {
      validator: function(arr) {
        // Check if it's an array and its length
        return Array.isArray(arr) && arr.length <= 10;
      },
      message: 'Cannot have more than 10 symptoms.'
    },
    default: [] // Ensure it defaults to an empty array
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [2000, 'Notes cannot be longer than 2000 characters.']
  },
  prescription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Prescription", // Ensure you have a 'Prescription' model defined
    default: null, // Null is appropriate if there isn't always a prescription
    index: true // Index this if you'll frequently query by prescription
  },
  isEmergency: {
    type: Boolean,
    default: false
  },
  cancellationReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Cancellation reason cannot be longer than 500 characters.'],
    // Validator: required only if status becomes 'cancelled'
    validate: {
      validator: function(value) {
        if (this.status === 'cancelled' && (!value || value.trim().length === 0)) {
          return false; // Return false if status is cancelled but reason is empty
        }
        return true;
      },
      message: 'Cancellation reason is required when the appointment status is cancelled.'
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "Creator ID is required"] // Who created this appointment
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    // Not required for initial creation, but useful for tracking later changes
  }
}, {
  timestamps: true, // Mongoose automatically manages createdAt and updatedAt
  toJSON: { virtuals: true, getters: true }, // Include virtuals and getters when converting to JSON
  toObject: { virtuals: true, getters: true } // Include virtuals and getters when converting to plain object
});

// --- Virtuals ---

// Virtual for duration (in minutes)
appointmentSchema.virtual('duration').get(function() {
  if (this.date && this.endTime) {
    const diffMs = this.endTime.getTime() - this.date.getTime();
    return diffMs / (1000 * 60); // Convert milliseconds to minutes
  }
  return null;
});

// --- Indexes for better query performance ---
// Compound index for doctor availability checks
appointmentSchema.index({ doctorId: 1, date: 1, endTime: 1 });
appointmentSchema.index({ patientId: 1, date: 1 });
appointmentSchema.index({ status: 1, date: 1 });
appointmentSchema.index({ date: 1 }); // Single index on date for general date queries

// --- Pre-save Hooks ---

// Pre-save hook to validate appointment time slot availability for the doctor
appointmentSchema.pre('save', async function(next) {
  // Only run this validation if 'date', 'endTime', or 'doctorId' have been modified or it's a new document
  if (this.isModified('date') || this.isModified('endTime') || this.isModified('doctorId') || this.isNew) {
    // If date or endTime are not valid or not set, let other validators catch it first
    if (!this.date || !this.endTime || isNaN(this.date.getTime()) || isNaN(this.endTime.getTime())) {
        return next();
    }

    // Ensure end time is after start time before checking for conflicts
    if (this.endTime <= this.date) {
        return next(new Error('Appointment end time must be after start time.'));
    }

    const conflictingAppointment = await this.constructor.findOne({
      doctorId: this.doctorId,
      // Exclude the current appointment being saved if it's an update
      _id: { $ne: this._id }, 
      // Check for overlap:
      // (startA < endB) && (endA > startB)
      // Where A is the current appointment being checked (this), and B is an existing one.
      // So, (this.date < existing.endTime) && (this.endTime > existing.date)
      // We are looking for existing appointments that conflict with `this`.
      // So the query should be for existing appointments `existing.date` and `existing.endTime`
      // that overlap with `this.date` and `this.endTime`.
      $or: [
        { date: { $lt: this.endTime, $gte: this.date } }, // existing appointment starts during this one
        { endTime: { $gt: this.date, $lte: this.endTime } }, // existing appointment ends during this one
        { date: { $lte: this.date }, endTime: { $gte: this.endTime } } // existing appointment fully contains this one
      ],
      status: { $in: ['pending', 'confirmed'] } // Only consider active appointments for conflict
    });

    if (conflictingAppointment) {
      return next(new Error('Doctor already has an overlapping appointment scheduled during this time.'));
    }
  }
  next(); // No conflicts found, proceed
});

// --- Static Methods ---

/**
 * Checks if a doctor is available for a given time slot.
 * @param {ObjectId} doctorId - The ID of the doctor.
 * @param {Date} startTime - The proposed start time of the appointment.
 * @param {Date} endTime - The proposed end time of the appointment.
 * @param {ObjectId} [excludeAppointmentId=null] - Optional: An appointment ID to exclude from the check (useful for updates).
 * @returns {Promise<boolean>} - True if doctor is available, false otherwise.
 */
appointmentSchema.statics.isDoctorAvailable = async function(doctorId, startTime, endTime, excludeAppointmentId = null) {
    if (!doctorId || !startTime || !endTime) {
        throw new Error('Doctor ID, start time, and end time are required for availability check.');
    }
    if (startTime >= endTime) {
        throw new Error('Start time must be before end time for availability check.');
    }

    const query = {
        doctorId,
        // Overlap logic: existing appointment's period (date to endTime) overlaps with new (startTime to endTime)
        date: { $lt: endTime }, // Existing starts before new ends
        endTime: { $gt: startTime }, // Existing ends after new starts
        status: { $in: ['pending', 'confirmed'] } // Only active appointments cause conflicts
    };

    if (excludeAppointmentId) {
        query._id = { $ne: excludeAppointmentId }; // Exclude the current appointment if updating
    }

    const count = await this.countDocuments(query);
    return count === 0; // If count is 0, doctor is available
};

// --- Instance Methods ---

/**
 * Cancels an appointment.
 * @param {string} reason - The reason for cancellation.
 * @param {ObjectId} cancelledBy - The user ID who cancelled the appointment.
 * @returns {Promise<Appointment>} - The updated appointment document.
 */
appointmentSchema.methods.cancelAppointment = async function(reason, cancelledBy) {
    // Add validation for cancelledBy
    if (!cancelledBy || !mongoose.Types.ObjectId.isValid(cancelledBy)) {
        throw new Error('A valid user ID is required to record cancellation.');
    }

    if (this.status === 'cancelled') {
        throw new Error('Appointment is already cancelled.');
    }

    // Allow cancellation of past appointments if needed, but the reason must be provided
    if (this.date < new Date() && !reason) {
        throw new Error('Cancellation reason is required for past appointments.');
    }

    if (!reason || reason.trim().length === 0) {
        throw new Error('Cancellation reason is required.');
    }

    this.status = 'cancelled';
    this.cancellationReason = reason.trim();
    this.updatedBy = cancelledBy; // Track who made the change
    return this.save(); // Save the document with updated status and reason
};

// --- Query Helpers ---

/**
 * Query helper to filter for upcoming appointments (date in future or current).
 */
appointmentSchema.query.upcoming = function() {
  return this.where('date').gte(new Date());
};

/**
 * Query helper to filter for past appointments (date before current).
 */
appointmentSchema.query.past = function() {
  return this.where('date').lt(new Date());
};

/**
 * Query helper to filter by status.
 * @param {string} status - The status to filter by (e.g., 'pending', 'confirmed').
 */
appointmentSchema.query.byStatus = function(status) {
    // Ensure status is valid before querying
    const validStatuses = ["pending", "confirmed", "completed", "cancelled", "no-show"];
    if (typeof status !== 'string' || !validStatuses.includes(status.toLowerCase())) {
        console.warn(`Invalid status '${status}' passed to byStatus query helper.`);
        return this.where('status').equals(''); // Return an empty result if status is invalid
    }
    return this.where('status').equals(status.toLowerCase());
};


const Appointment = mongoose.model("Appointment", appointmentSchema);

export default Appointment;