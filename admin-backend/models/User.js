import mongoose from "mongoose";
import bcrypt from "bcryptjs"; // Make sure to install bcryptjs: npm install bcryptjs

const userSchema = new mongoose.Schema({
  // Basic Information (common for all users)
  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true,
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    lowercase: true,
    // Using a more robust email regex often found in libraries or from reliable sources
    validate: {
      validator: function(v) {
        return /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(v);
      },
      message: "Please enter a valid email address",
    },
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: [6, "Password must be at least 6 characters long"],
    select: false, // Prevents password from being returned in queries by default
  },
  role: {
    type: String,
    enum: ["doctor", "patient", "admin"],
    required: [true, "Role is required"],
    default: "patient",
  },
  phone: {
    type: String,
    // A more flexible regex for phone numbers, consider international formats if needed
    // This regex allows for various common formats including optional country code, parentheses, spaces, dots, and hyphens.
    validate: {
      validator: function(v) {
        return /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/.test(v);
      },
      message: "Please enter a valid phone number (e.g., +1234567890, 123-456-7890)",
    },
    // Adding sparse index if many users might not have a phone, to avoid duplicate errors
    // unique: true, // Only if phone numbers must be unique across ALL users
    // sparse: true // Use with unique if field can be null/undefined
  },
  address: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    country: { type: String, trim: true },
  },
  dateOfBirth: Date,
  gender: {
    type: String,
    enum: ["male", "female", "other", "prefer-not-to-say"],
  },
  profilePicture: String,
  isActive: {
    type: Boolean,
    default: true,
  },

  // Doctor-specific fields
  specialty: {
    type: String,
    required: function() {
      return this.role === "doctor";
    },
    trim: true
  },
  qualifications: [{
    _id: false, // Don't create _id for sub-documents in array if not needed
    degree: { type: String, trim: true },
    university: { type: String, trim: true },
    year: Number,
  }],
  licenseNumber: {
    type: String,
    required: function() {
      return this.role === "doctor";
    },
    unique: true, // License numbers should typically be unique
    sparse: true, // Allows multiple null license numbers if role is not doctor
    trim: true
  },
  experience: {
    type: Number, // in years
    min: [0, "Experience cannot be negative"],
  },
  bio: { type: String, trim: true },
  consultationFee: {
    type: Number,
    min: [0, "Consultation fee cannot be negative"],
    default: 0 // A default value
  },
  availableDays: [{
    type: String,
    enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
    lowercase: true // Ensure consistency
  }],
  workingHours: {
    start: { type: String, trim: true }, // e.g., "09:00"
    end: { type: String, trim: true } // e.g., "17:00"
  },
  hospitalAffiliation: [{
    _id: false, // Don't create _id for sub-documents in array if not needed
    name: { type: String, trim: true },
    address: { type: String, trim: true },
    position: { type: String, trim: true },
  }],

  // Patient-specific fields
  bloodGroup: {
    type: String,
    enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
  },
  height: Number, // in cm
  weight: Number, // in kg
  allergies: [String], // Array of strings
  medications: [String], // Array of strings
  medicalHistory: [{
    _id: false, // Don't create _id for sub-documents in array if not needed
    condition: { type: String, trim: true },
    diagnosedOn: Date,
    status: {
      type: String,
      enum: ["active", "resolved", "chronic"],
      lowercase: true // Ensure consistency
    },
  }],
  emergencyContact: {
    name: { type: String, trim: true },
    relationship: { type: String, trim: true },
    phone: { type: String, trim: true }, // Consider same phone validation as main phone field if strict
  },
  insuranceInfo: {
    provider: { type: String, trim: true },
    policyNumber: { type: String, trim: true },
    validUntil: Date,
  },
}, {
  timestamps: true, // Mongoose handles createdAt and updatedAt automatically
  toJSON: {
    // virtuals: true, // If you have virtual properties
    transform: function(doc, ret) {
      // Clean up internal Mongoose fields from JSON output if not already removed by .select()
      delete ret.__v;
      delete ret.password; // Ensure password is removed even if not selected
      // You could add more transformations here if needed
    }
  },
  toObject: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      delete ret.password;
    }
  }
});

// --- Middleware ---

// Password Hashing Middleware
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err); // Pass error to next middleware
  }
});

// --- Static Methods ---

userSchema.statics.findDoctors = function() {
  // Use .lean() for faster queries if you don't need Mongoose document methods
  return this.find({ role: 'doctor', isActive: true }).select('-password -__v');
};

userSchema.statics.findPatients = function() {
  // Use .lean() for faster queries
  return this.find({ role: 'patient', isActive: true }).select('-password -__v');
};

// --- Instance Methods ---

// Method to compare candidate password with hashed password
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// You can keep these, but often the static methods or direct queries are sufficient
// and using .select('-password') at the query level is more common.
// If you want to return a clean object without password
userSchema.methods.getProfile = function() {
  const user = this.toObject();
  delete user.password; // Ensure password is removed
  return user;
};


const User = mongoose.model("User", userSchema);

export default User;