import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import connectDB from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// ── Routes ───────────────────────────────────────────────────────────────────
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import adminRoutes from './routes/admin.js';
import appointmentRoutes from './routes/appointments.js';
import labTestRoutes from './routes/labTests.js';
import prescriptionRoutes from './routes/prescriptions.js';

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/lab-tests', labTestRoutes);
app.use('/api/prescriptions', prescriptionRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend in production
const frontendDistPath = path.join(__dirname, '../frontend/dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  
  // Serve index.html for all non-API routes (SPA routing)
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

 app.get("/", (req, res) => {
  res.send(" Artifix API is running successfully");
});


// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found` });
});



// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

// ── Seed admin ───────────────────────────────────────────────────────────────
const seedAdmin = async () => {
  try {
    const { default: User } = await import('./models/User.js');
    const bcrypt = await import('bcryptjs');

    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      const hashed = await bcrypt.default.hash('admin123', 12);
      await User.create({
        name: 'System Admin',
        email: 'admin@medicare.com',
        password: hashed,
        phone: '9000000000',
        role: 'admin',
        isActive: true,
      });
      console.log('✅ Admin seeded → admin@medicare.com / admin123');
    }

    // Seed 2 sample doctors if none exist
    const doctorCount = await User.countDocuments({ role: 'doctor' });
    if (doctorCount === 0) {
      const hash1 = await bcrypt.default.hash('doctor123', 12);
      await User.create([
        {
          name: 'Dr. Arun Kumar',
          email: 'arun.kumar@medicare.com',
          password: hash1,
          phone: '9811234567',
          role: 'doctor',
          specialization: 'Cardiologist',
          experience: 12,
          consultationFee: 800,
          department: 'Cardiology',
          registrationToken: 'DOCTOKEN',
          tokenUsed: true,
          qualifications: 'MBBS, MD (Cardiology), DM',
          about: 'Senior cardiologist with 12 years of experience in interventional cardiology.',
          isActive: true,
        },
        {
          name: 'Dr. Priya Nair',
          email: 'priya.nair@medicare.com',
          password: hash1,
          phone: '9822345678',
          role: 'doctor',
          specialization: 'Neurologist',
          experience: 8,
          consultationFee: 700,
          department: 'Neurology',
          registrationToken: 'DOCTOKEN2',
          tokenUsed: true,
          qualifications: 'MBBS, MD (Neurology)',
          about: 'Experienced neurologist specialising in epilepsy and movement disorders.',
          isActive: true,
        },
        {
          name: 'Dr. Rahul Sharma',
          email: 'rahul.sharma@medicare.com',
          password: hash1,
          phone: '9833456789',
          role: 'doctor',
          specialization: 'Orthopedic Surgeon',
          experience: 15,
          consultationFee: 900,
          department: 'Orthopaedics',
          registrationToken: 'DOCTOKEN3',
          tokenUsed: true,
          qualifications: 'MBBS, MS (Ortho), DNB',
          about: 'Expert in joint replacement and sports injury management.',
          isActive: true,
        },
      ]);
      console.log('✅ 3 sample doctors seeded');
    }

    // Seed a lab technician if none exist
    const techCount = await User.countDocuments({ role: 'lab_technician' });
    if (techCount === 0) {
      const hashTech = await bcrypt.default.hash('tech123', 12);
      await User.create({
        name: 'Ramesh Menon',
        email: 'ramesh.menon@medicare.com',
        password: hashTech,
        phone: '9844567890',
        role: 'lab_technician',
        department: 'Pathology',
        labSection: 'Haematology & Biochemistry',
        registrationToken: 'TECHTOKEN',
        tokenUsed: true,
        isActive: true,
      });
      console.log('✅ Sample lab technician seeded → ramesh.menon@medicare.com / tech123');
    }
  } catch (err) {
    console.error('Seed error:', err.message);
  }
};

// ── Connect & Start ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    console.log('✅ MongoDB connected');
    seedAdmin();
    app.listen(PORT, () => {
      console.log(`✅ Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });
 