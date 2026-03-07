import mongoose from 'mongoose';

const labTestSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    technician: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    testCategory: { type: String, required: true },
    testName: { type: String, required: true },
    subCategory: { type: String, required: true },
    scheduledDate: { type: Date, required: true },
    scheduledTime: { type: String, required: true },
    amount: { type: Number, required: true },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid'],
      default: 'pending',
    },
    status: {
      type: String,
      enum: ['scheduled', 'in_progress', 'completed', 'cancelled', 'expired'],
      default: 'scheduled',
    },
    results: {
      reportData: { type: mongoose.Schema.Types.Mixed, default: null },
      reportFile: { type: String, default: '' },
      uploadedAt: { type: Date },
      notes: { type: String, default: '' },
      parameters: [
        {
          name: String,
          value: String,
          unit: String,
          normalRange: String,
          status: { type: String, enum: ['normal', 'high', 'low', ''], default: '' },
        },
      ],
    },
    tokenNumber: { type: String, required: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export default mongoose.model('LabTest', labTestSchema);
