import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  // Basic Information (common for all users)
  name: { 
    type: String, 
    required: [true, "Name is required"],
    trim: true
  },
  email: { 
    type: String, 
    required: [true, "Email is required"],
    unique: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(v);
      },
      message: "Please enter a valid email"
    }
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: [6, "Password must be at least 6 characters"],
    select: false // Never return password in queries
  },
  role: { 
    type: String, 
    enum: ["doctor", "patient", "admin"], 
    required: [true, "Role is required"],
    default: "patient"
  },
  phone: {
    type: String,
    validate: {
      validator: function(v) {
        return /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/.test(v);
      },
      message: "Please enter a valid phone number"
    }
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  dateOfBirth: Date,
  gender: {
    type: String,
    enum: ["male", "female", "other", "prefer-not-to-say"]
  },
  profilePicture: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },

  // Doctor-specific fields
  specialty: {
    type: String,
    required: function() {
      return this.role === "doctor";
    }
  },
  qualifications: [{
    degree: String,
    university: String,
    year: Number
  }],
  licenseNumber: {
    type: String,
    required: function() {
      return this.role === "doctor";
    }
  },
  experience: {
    type: Number, // in years
    min: 0
  },
  bio: String,
  consultationFee: {
    type: Number,
    min: 0
  },
  availableDays: [{
    type: String,
    enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
  }],
  workingHours: {
    start: String, // e.g., "09:00"
    end: String    // e.g., "17:00"
  },
  hospitalAffiliation: [{
    name: String,
    address: String,
    position: String
  }],

  // Patient-specific fields
  bloodGroup: {
    type: String,
    enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
  },
  height: Number, // in cm
  weight: Number, // in kg
  allergies: [String],
  medications: [String],
  medicalHistory: [{
    condition: String,
    diagnosedOn: Date,
    status: {
      type: String,
      enum: ["active", "resolved", "chronic"]
    }
  }],
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String
  },
  insuranceInfo: {
    provider: String,
    policyNumber: String,
    validUntil: Date
  }
});

// Middleware to update 'updatedAt' field before saving
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to find doctors
userSchema.statics.findDoctors = function() {
  return this.find({ role: 'doctor' }).select('-password');
};

// Static method to find patients
userSchema.statics.findPatients = function() {
  return this.find({ role: 'patient' }).select('-password');
};

// Instance method for doctors
userSchema.methods.getDoctorProfile = function() {
  const doctor = this.toObject();
  delete doctor.password;
  return doctor;
};

// Instance method for patients
userSchema.methods.getPatientProfile = function() {
  const patient = this.toObject();
  delete patient.password;
  return patient;
};

const User = mongoose.model("User", userSchema);

export default User;