import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    appointmentDate: { type: Date, required: true },
    appointmentTime: { type: String, required: true },
    tokenNumber: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled', 'expired', 'no_show'],
      default: 'confirmed',
    },
    symptoms: { type: String, default: '' },
    notes: { type: String, default: '' },
    checkedIn: { type: Boolean, default: false },
    checkedInAt: { type: Date },
    consultationFeeAtBooking: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model('Appointment', appointmentSchema);
