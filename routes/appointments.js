import express from 'express';
import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

// Helper: get next token number for a doctor on a date
const getNextToken = async (doctorId, dateStr) => {
  const start = new Date(dateStr + 'T00:00:00.000Z');
  const end = new Date(dateStr + 'T23:59:59.999Z');
  const count = await Appointment.countDocuments({
    doctor: doctorId,
    appointmentDate: { $gte: start, $lte: end },
    status: { $nin: ['cancelled'] },
  });
  return String(count + 1).padStart(3, '0');
};

// Helper: auto-expire past appointments
const expirePastAppointments = async () => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const todayStart = new Date(todayStr + 'T00:00:00.000Z');

  // Expire all confirmed appointments from before today
  await Appointment.updateMany(
    { appointmentDate: { $lt: todayStart }, status: 'confirmed' },
    { status: 'expired' }
  );

  // Expire today's appointments where time + 30 min has passed
  const todayAppts = await Appointment.find({
    appointmentDate: { $gte: todayStart },
    status: 'confirmed',
  });

  for (const appt of todayAppts) {
    const [h, m] = appt.appointmentTime.split(':').map(Number);
    const apptDateTime = new Date(appt.appointmentDate);
    apptDateTime.setUTCHours(h, m + 30, 0, 0);
    if (now > apptDateTime) {
      appt.status = 'expired';
      await appt.save();
    }
  }
};

// @route POST /api/appointments
// @access Patient
router.post('/', authorize('patient'), async (req, res) => {
  try {
    const { doctorId, appointmentDate, appointmentTime, symptoms, notes } = req.body;

    if (!doctorId || !appointmentDate || !appointmentTime) {
      return res.status(400).json({ message: 'Doctor, date and time are required' });
    }

    const doctor = await User.findById(doctorId);
    if (!doctor || doctor.role !== 'doctor' || !doctor.isActive) {
      return res.status(404).json({ message: 'Doctor not found or inactive' });
    }

    // Prevent past booking
    const apptDateTime = new Date(`${appointmentDate}T${appointmentTime}:00`);
    if (apptDateTime < new Date()) {
      return res.status(400).json({ message: 'Cannot book appointments in the past' });
    }

    // Check for duplicate booking same patient same doctor same slot
    const duplicate = await Appointment.findOne({
      patient: req.user._id,
      doctor: doctorId,
      appointmentDate: new Date(appointmentDate),
      appointmentTime,
      status: { $nin: ['cancelled', 'expired'] },
    });
    if (duplicate) {
      return res.status(400).json({ message: 'You already have an appointment at this slot' });
    }

    const tokenNumber = await getNextToken(doctorId, appointmentDate);

    const appointment = await Appointment.create({
      patient: req.user._id,
      doctor: doctorId,
      appointmentDate: new Date(appointmentDate),
      appointmentTime,
      tokenNumber,
      symptoms: symptoms || '',
      notes: notes || '',
      status: 'confirmed',
      consultationFeeAtBooking: doctor.consultationFee || 0,
    });

    const populated = await Appointment.findById(appointment._id)
      .populate('doctor', 'name specialization consultationFee profilePicture department')
      .populate('patient', 'name phone email gender bloodGroup');

    res.status(201).json(populated);
  } catch (err) {
    console.error('Book appointment error:', err);
    res.status(500).json({ message: err.message });
  }
});

// @route GET /api/appointments/my
// @access Patient
router.get('/my', authorize('patient'), async (req, res) => {
  try {
    await expirePastAppointments();
    const appointments = await Appointment.find({ patient: req.user._id })
      .populate('doctor', 'name specialization consultationFee profilePicture department phone email')
      .sort({ appointmentDate: -1, createdAt: -1 });
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route GET /api/appointments/doctor/mine
// @access Doctor
router.get('/doctor/mine', authorize('doctor'), async (req, res) => {
  try {
    await expirePastAppointments();
    const appointments = await Appointment.find({ doctor: req.user._id })
      .populate('patient', 'name phone email gender bloodGroup dateOfBirth address profilePicture')
      .sort({ appointmentDate: 1, appointmentTime: 1 });
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route GET /api/appointments/doctor/:doctorId
// @access Admin, Doctor
router.get('/doctor/:doctorId', async (req, res) => {
  try {
    await expirePastAppointments();
    const appointments = await Appointment.find({ doctor: req.params.doctorId })
      .populate('patient', 'name phone email gender bloodGroup dateOfBirth address profilePicture')
      .sort({ appointmentDate: 1, appointmentTime: 1 });
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route GET /api/appointments/all
// @access Admin
router.get('/all', authorize('admin'), async (req, res) => {
  try {
    await expirePastAppointments();
    const appointments = await Appointment.find()
      .populate('patient', 'name phone email')
      .populate('doctor', 'name specialization')
      .sort({ createdAt: -1 });
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route GET /api/appointments/doctors
// @access Authenticated
router.get('/doctors', async (req, res) => {
  try {
    const doctors = await User.find({ role: 'doctor', isActive: true })
      .select('-password -registrationToken')
      .sort({ name: 1 });
    res.json(doctors);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route PATCH /api/appointments/:id/cancel
// @access Patient, Admin
router.patch('/:id/cancel', async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });

    // Only patient who owns it or admin can cancel
    if (
      req.user.role !== 'admin' &&
      appt.patient.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (appt.status === 'completed') {
      return res.status(400).json({ message: 'Cannot cancel a completed appointment' });
    }

    appt.status = 'cancelled';
    await appt.save();
    res.json({ message: 'Appointment cancelled successfully', appointment: appt });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route PATCH /api/appointments/:id/checkin
// @access Doctor, Admin
router.patch('/:id/checkin', authorize('doctor', 'admin'), async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id).populate('patient', 'name phone');
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });

    if (appt.status !== 'confirmed') {
      return res.status(400).json({ message: `Cannot check in – status is "${appt.status}"` });
    }

    // Strict time check: patient must check in within 30 min of appointment time
    const [h, m] = appt.appointmentTime.split(':').map(Number);
    const apptDateTime = new Date(appt.appointmentDate);
    apptDateTime.setUTCHours(h, m, 0, 0);
    const deadline = new Date(apptDateTime.getTime() + 30 * 60 * 1000);
    const now = new Date();

    if (now > deadline) {
      appt.status = 'expired';
      await appt.save();
      return res.status(400).json({
        message: 'Appointment time has passed. Patient is not allowed for check-in.',
      });
    }

    appt.checkedIn = true;
    appt.checkedInAt = now;
    appt.status = 'completed';
    await appt.save();

    res.json({ message: 'Patient checked in successfully', appointment: appt });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route PATCH /api/appointments/:id/complete
// @access Doctor
router.patch('/:id/complete', authorize('doctor', 'admin'), async (req, res) => {
  try {
    const appt = await Appointment.findByIdAndUpdate(
      req.params.id,
      { status: 'completed' },
      { new: true }
    );
    if (!appt) return res.status(404).json({ message: 'Not found' });
    res.json(appt);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
