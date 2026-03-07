import mongoose from 'mongoose';

const medicineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  dosage: { type: String, default: '' },
  frequency: { type: String, default: '' },
  duration: { type: String, default: '' },
  instructions: { type: String, default: '' },
});

const injectionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  dosage: { type: String, default: '' },
  schedule: { type: String, default: '' },
  route: { type: String, default: '' },
});

const prescriptionSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
    diagnosis: { type: String, required: true },
    medicines: [medicineSchema],
    injections: [injectionSchema],
    labTestsRecommended: [{ type: String }],
    nextCheckupDate: { type: Date },
    dietaryAdvice: { type: String, default: '' },
    notes: { type: String, default: '' },
    followUpInstructions: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('Prescription', prescriptionSchema);
