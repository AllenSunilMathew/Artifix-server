import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Multer config
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `profile_${req.user._id}_${Date.now()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (ext && mime) cb(null, true);
  else cb(new Error('Only image files are allowed'));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

router.use(protect);

// @route GET /api/users/profile
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -registrationToken');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route PATCH /api/users/profile
router.patch('/profile', async (req, res) => {
  try {
    const allowedFields = ['name', 'phone', 'address', 'gender', 'bloodGroup', 'dateOfBirth', 'about', 'qualifications'];
    const updates = {};
    allowedFields.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });
    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select('-password -registrationToken');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route POST /api/users/upload-picture
router.post('/upload-picture', upload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    // Delete old picture if exists
    const currentUser = await User.findById(req.user._id);
    if (currentUser.profilePicture) {
      const oldPath = path.join(__dirname, '..', currentUser.profilePicture);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const picUrl = `/uploads/${req.file.filename}`;
    await User.findByIdAndUpdate(req.user._id, { profilePicture: picUrl });
    res.json({ profilePicture: picUrl, message: 'Profile picture updated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route GET /api/users/doctors — get all active doctors
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

export default router;
