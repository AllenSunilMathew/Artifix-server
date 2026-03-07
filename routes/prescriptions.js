import express from 'express';
import Prescription from '../models/Prescription.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

// @route POST /api/prescriptions
// @access Doctor
router.post('/', authorize('doctor'), async (req, res) => {
  try {
    const {
      patientId,
      appointmentId,
      diagnosis,
      medicines,
      injections,
      labTestsRecommended,
      nextCheckupDate,
      dietaryAdvice,
      notes,
      followUpInstructions,
    } = req.body;

    if (!patientId || !diagnosis) {
      return res.status(400).json({ message: 'Patient ID and diagnosis are required' });
    }

    const prescription = await Prescription.create({
      patient: patientId,
      doctor: req.user._id,
      appointment: appointmentId || undefined,
      diagnosis,
      medicines: medicines || [],
      injections: injections || [],
      labTestsRecommended: labTestsRecommended || [],
      nextCheckupDate: nextCheckupDate || undefined,
      dietaryAdvice: dietaryAdvice || '',
      notes: notes || '',
      followUpInstructions: followUpInstructions || '',
    });

    const populated = await Prescription.findById(prescription._id)
      .populate('patient', 'name email phone gender bloodGroup dateOfBirth')
      .populate('doctor', 'name specialization department')
      .populate('appointment', 'appointmentDate appointmentTime tokenNumber');

    res.status(201).json(populated);
  } catch (err) {
    console.error('Create prescription error:', err);
    res.status(500).json({ message: err.message });
  }
});

// @route GET /api/prescriptions/patient/:patientId
// @access Patient (own), Doctor, Admin
router.get('/patient/:patientId', async (req, res) => {
  try {
    // Patient can only access their own
    if (
      req.user.role === 'patient' &&
      req.user._id.toString() !== req.params.patientId
    ) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const prescriptions = await Prescription.find({ patient: req.params.patientId })
      .populate('doctor', 'name specialization department profilePicture')
      .populate('appointment', 'appointmentDate appointmentTime tokenNumber')
      .sort({ createdAt: -1 });

    res.json(prescriptions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route GET /api/prescriptions/doctor/mine
// @access Doctor
router.get('/doctor/mine', authorize('doctor'), async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ doctor: req.user._id })
      .populate('patient', 'name email phone gender bloodGroup dateOfBirth profilePicture')
      .populate('appointment', 'appointmentDate appointmentTime tokenNumber')
      .sort({ createdAt: -1 });
    res.json(prescriptions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route GET /api/prescriptions/all
// @access Admin
router.get('/all', authorize('admin'), async (req, res) => {
  try {
    const prescriptions = await Prescription.find()
      .populate('patient', 'name email phone')
      .populate('doctor', 'name specialization')
      .sort({ createdAt: -1 });
    res.json(prescriptions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route GET /api/prescriptions/:id
// @access Authenticated
router.get('/:id', async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id)
      .populate('patient', 'name email phone gender bloodGroup dateOfBirth')
      .populate('doctor', 'name specialization department profilePicture')
      .populate('appointment', 'appointmentDate appointmentTime tokenNumber');
    if (!prescription) return res.status(404).json({ message: 'Prescription not found' });
    res.json(prescription);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
