import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    phone: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ['patient', 'doctor', 'admin', 'lab_technician'],
      default: 'patient',
    },
    profilePicture: { type: String, default: '' },
    address: { type: String, default: '' },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['male', 'female', 'other', ''], default: '' },
    bloodGroup: { type: String, default: '' },

    // Doctor-specific fields
    specialization: { type: String, default: '' },
    experience: { type: Number, default: 0 },
    consultationFee: { type: Number, default: 0 },
    department: { type: String, default: '' },
    qualifications: { type: String, default: '' },
    about: { type: String, default: '' },

    // Lab technician specific
    labSection: { type: String, default: '' },

    // Staff registration via admin token
    registrationToken: { type: String, default: '' },
    tokenUsed: { type: Boolean, default: false },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
