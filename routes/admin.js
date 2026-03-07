import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import LabTest from '../models/LabTest.js';
import Prescription from '../models/Prescription.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(protect, authorize('admin'));

// Helper: generate short token
const generateStaffToken = () =>
  uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();

// @route GET /api/admin/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const [
      totalPatients,
      totalDoctors,
      totalLabTechs,
      totalAppointments,
      totalLabTests,
      totalPrescriptions,
    ] = await Promise.all([
      User.countDocuments({ role: 'patient' }),
      User.countDocuments({ role: 'doctor' }),
      User.countDocuments({ role: 'lab_technician' }),
      Appointment.countDocuments(),
      LabTest.countDocuments(),
      Prescription.countDocuments(),
    ]);

    // Revenue from paid lab tests
    const paidTests = await LabTest.find({ paymentStatus: 'paid' }).select('amount');
    const labRevenue = paidTests.reduce((s, t) => s + (t.amount || 0), 0);

    // Consultation revenue from completed appointments
    const completedAppts = await Appointment.find({ status: 'completed' }).select(
      'consultationFeeAtBooking'
    );
    const consultRevenue = completedAppts.reduce(
      (s, a) => s + (a.consultationFeeAtBooking || 0),
      0
    );

    const totalRevenue = labRevenue + consultRevenue;

    // Recent data
    const recentAppointments = await Appointment.find()
      .populate('patient', 'name email phone')
      .populate('doctor', 'name specialization')
      .sort({ createdAt: -1 })
      .limit(10);

    const recentLabTests = await LabTest.find()
      .populate('patient', 'name email phone')
      .populate('technician', 'name')
      .sort({ createdAt: -1 })
      .limit(10);

    // Monthly stats (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyAppointments = await Appointment.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    res.json({
      stats: {
        totalPatients,
        totalDoctors,
        totalLabTechs,
        totalAppointments,
        totalLabTests,
        totalPrescriptions,
        totalRevenue,
        labRevenue,
        consultRevenue,
      },
      recentAppointments,
      recentLabTests,
      monthlyAppointments,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ message: err.message });
  }
});

// @route POST /api/admin/add-staff
router.post('/add-staff', async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      role,
      specialization,
      experience,
      consultationFee,
      department,
      qualifications,
      about,
      labSection,
    } = req.body;

    if (!name || !email || !password || !phone || !role) {
      return res.status(400).json({ message: 'Name, email, password, phone and role are required' });
    }

    if (!['doctor', 'lab_technician'].includes(role)) {
      return res.status(400).json({ message: 'Role must be doctor or lab_technician' });
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);
    const registrationToken = generateStaffToken();

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      phone: phone.trim(),
      role,
      specialization: specialization || '',
      experience: experience ? Number(experience) : 0,
      consultationFee: consultationFee ? Number(consultationFee) : 0,
      department: department || '',
      qualifications: qualifications || '',
      about: about || '',
      labSection: labSection || '',
      registrationToken,
      tokenUsed: false,
    });

    res.status(201).json({
      message: 'Staff member added successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        specialization: user.specialization,
        department: user.department,
      },
      registrationToken,
    });
  } catch (err) {
    console.error('Add staff error:', err);
    res.status(500).json({ message: err.message });
  }
});

// @route GET /api/admin/staff
router.get('/staff', async (req, res) => {
  try {
    const staff = await User.find({ role: { $in: ['doctor', 'lab_technician'] } })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json(staff);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route GET /api/admin/patients
router.get('/patients', async (req, res) => {
  try {
    const patients = await User.find({ role: 'patient' })
      .select('-password -registrationToken')
      .sort({ createdAt: -1 });
    res.json(patients);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route GET /api/admin/appointments
router.get('/appointments', async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate('patient', 'name email phone gender bloodGroup')
      .populate('doctor', 'name specialization department')
      .sort({ createdAt: -1 });
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route GET /api/admin/lab-tests
router.get('/lab-tests', async (req, res) => {
  try {
    const tests = await LabTest.find()
      .populate('patient', 'name email phone')
      .populate('technician', 'name')
      .sort({ createdAt: -1 });
    res.json(tests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route GET /api/admin/prescriptions
router.get('/prescriptions', async (req, res) => {
  try {
    const prescriptions = await Prescription.find()
      .populate('patient', 'name email phone gender bloodGroup')
      .populate('doctor', 'name specialization')
      .sort({ createdAt: -1 });
    res.json(prescriptions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route PATCH /api/admin/toggle-user/:id
router.patch('/toggle-user/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin') {
      return res.status(400).json({ message: 'Cannot deactivate admin account' });
    }
    user.isActive = !user.isActive;
    await user.save();
    res.json({
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: user.isActive,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route DELETE /api/admin/user/:id
router.delete('/user/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin') {
      return res.status(400).json({ message: 'Cannot delete admin account' });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route GET /api/admin/regenerate-token/:userId
router.patch('/regenerate-token/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const newToken = generateStaffToken();
    user.registrationToken = newToken;
    user.tokenUsed = false;
    await user.save();
    res.json({ message: 'Token regenerated', registrationToken: newToken });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
