import mongoose from "mongoose";
import validator from "validator";

const appointmentSchema = new mongoose.Schema({
  doctorId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: [true, "Doctor ID is required"],
    validate: {
      validator: async function(value) {
        const doctor = await mongoose.model('User').findOne({ _id: value, role: 'doctor' });
        return !!doctor;
      },
      message: 'Doctor not found or not a valid doctor'
    }
  },
  patientId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: [true, "Patient ID is required"],
    validate: {
      validator: async function(value) {
        const patient = await mongoose.model('User').findOne({ _id: value, role: 'patient' });
        return !!patient;
      },
      message: 'Patient not found or not a valid patient'
    }
  },
  date: { 
    type: Date, 
    required: [true, "Appointment date is required"],
    validate: {
      validator: function(value) {
        return value > new Date();
      },
      message: 'Appointment date must be in the future'
    }
  },
  endTime: {
    type: Date,
    required: [true, "Appointment end time is required"],
    validate: {
      validator: function(value) {
        return value > this.date;
      },
      message: 'End time must be after start time'
    }
  },
  status: { 
    type: String, 
    enum: {
      values: ["pending", "confirmed", "completed", "cancelled", "no-show"],
      message: 'Status must be pending, confirmed, completed, cancelled, or no-show'
    }, 
    default: "pending" 
  },
  reason: {
    type: String,
    trim: true,
    maxlength: [500, 'Reason cannot be longer than 500 characters']
  },
  symptoms: {
    type: [String],
    validate: {
      validator: function(arr) {
        return arr.length <= 10;
      },
      message: 'Cannot have more than 10 symptoms'
    }
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [2000, 'Notes cannot be longer than 2000 characters']
  },
  prescription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Prescription",
    default: null
  },
  isEmergency: {
    type: Boolean,
    default: false
  },
  cancellationReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Cancellation reason cannot be longer than 500 characters'],
    validate: {
      validator: function(value) {
        // Only required if status is cancelled
        if (this.status === 'cancelled') {
          return value && value.trim().length > 0;
        }
        return true;
      },
      message: 'Cancellation reason is required when status is cancelled'
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for duration (in minutes)
appointmentSchema.virtual('duration').get(function() {
  return (this.endTime - this.date) / (1000 * 60);
});

// Indexes for better query performance
appointmentSchema.index({ doctorId: 1, date: 1 });
appointmentSchema.index({ patientId: 1, date: 1 });
appointmentSchema.index({ status: 1, date: 1 });
appointmentSchema.index({ date: 1 });

// Pre-save hook to validate appointment time slot availability
appointmentSchema.pre('save', async function(next) {
  if (this.isModified('date') || this.isModified('doctorId') || this.isModified('endTime')) {
    const conflictingAppointment = await this.constructor.findOne({
      doctorId: this.doctorId,
      _id: { $ne: this._id },
      $or: [
        { 
          date: { $lt: this.endTime }, 
          endTime: { $gt: this.date } 
        }
      ],
      status: { $in: ['pending', 'confirmed'] }
    });

    if (conflictingAppointment) {
      throw new Error('Doctor already has an appointment scheduled during this time');
    }
  }
  next();
});

// Static method to check doctor availability
appointmentSchema.statics.isDoctorAvailable = async function(doctorId, startTime, endTime, excludeAppointmentId = null) {
  const query = {
    doctorId,
    date: { $lt: endTime },
    endTime: { $gt: startTime },
    status: { $in: ['pending', 'confirmed'] }
  };

  if (excludeAppointmentId) {
    query._id = { $ne: excludeAppointmentId };
  }

  const count = await this.countDocuments(query);
  return count === 0;
};

// Instance method to cancel appointment
appointmentSchema.methods.cancelAppointment = async function(reason, cancelledBy) {
  if (this.status === 'cancelled') {
    throw new Error('Appointment is already cancelled');
  }

  if (this.date < new Date()) {
    throw new Error('Cannot cancel past appointments');
  }

  this.status = 'cancelled';
  this.cancellationReason = reason;
  this.updatedBy = cancelledBy;
  return this.save();
};

// Query helper for upcoming appointments
appointmentSchema.query.upcoming = function() {
  return this.where('date').gte(new Date());
};

// Query helper for past appointments
appointmentSchema.query.past = function() {
  return this.where('date').lt(new Date());
};

// Query helper by status
appointmentSchema.query.byStatus = function(status) {
  return this.where('status').equals(status);
};

const Appointment = mongoose.model("Appointment", appointmentSchema);

export default Appointment;