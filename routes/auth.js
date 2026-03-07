import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone,
  profilePicture: user.profilePicture,
  specialization: user.specialization,
  department: user.department,
  gender: user.gender,
  bloodGroup: user.bloodGroup,
  address: user.address,
  dateOfBirth: user.dateOfBirth,
  consultationFee: user.consultationFee,
  experience: user.experience,
  about: user.about,
  isActive: user.isActive,
});

// @route  POST /api/auth/register
// @desc   Register patient only
// @access Public
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, dateOfBirth, gender, bloodGroup, address } =
      req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ message: 'Name, email, password and phone are required' });
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      return res.status(400).json({ message: 'An account with this email already exists' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      phone: phone.trim(),
      dateOfBirth: dateOfBirth || undefined,
      gender: gender || '',
      bloodGroup: bloodGroup || '',
      address: address || '',
      role: 'patient',
    });

    const token = generateToken(user._id);
    res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: err.message });
  }
});

// @route  POST /api/auth/login
// @desc   Login all roles. Doctors/techs need registrationToken on first login
// @access Public
router.post('/login', async (req, res) => {
  try {
    const { email, password, registrationToken } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Your account has been deactivated. Contact admin.' });
    }

    // Staff require registration token on first login
    if (
      (user.role === 'doctor' || user.role === 'lab_technician') &&
      !user.tokenUsed
    ) {
      if (!registrationToken) {
        return res.status(400).json({
          message: 'Registration token required for first login',
          requiresToken: true,
        });
      }
      if (registrationToken.trim().toUpperCase() !== user.registrationToken.toUpperCase()) {
        return res.status(400).json({ message: 'Invalid registration token' });
      }
      user.tokenUsed = true;
      await user.save();
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const token = generateToken(user._id);
    res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: err.message });
  }
});

// @route  GET /api/auth/me
// @desc   Get current logged-in user
// @access Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -registrationToken');
    res.json(sanitizeUser(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
