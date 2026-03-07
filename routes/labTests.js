import express from 'express';
import LabTest from '../models/LabTest.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

// ── Catalog ─────────────────────────────────────────────────────────────────
export const LAB_CATALOG = {
  'Blood Tests': {
    icon: '🩸',
    description: 'Comprehensive blood analysis',
    subcategories: [
      { name: 'Complete Blood Count (CBC)', price: 500, turnaround: '4 hours', description: 'Full blood panel including RBC, WBC, platelets' },
      { name: 'Blood Sugar Fasting & PP', price: 350, turnaround: '2 hours', description: 'Diabetes screening and monitoring' },
      { name: 'Lipid Profile', price: 750, turnaround: '6 hours', description: 'Cholesterol, triglycerides, HDL, LDL' },
    ],
  },
  'Urine Tests': {
    icon: '🧫',
    description: 'Urinary system analysis',
    subcategories: [
      { name: 'Urinalysis (Routine)', price: 400, turnaround: '2 hours', description: 'Physical, chemical and microscopic examination' },
      { name: 'Urine Culture & Sensitivity', price: 650, turnaround: '48 hours', description: 'Bacterial infection detection and antibiotic sensitivity' },
      { name: 'Kidney Function Test (KFT)', price: 850, turnaround: '6 hours', description: 'Creatinine, BUN, uric acid, electrolytes' },
    ],
  },
  'Imaging & Radiology': {
    icon: '🔬',
    description: 'Diagnostic imaging services',
    subcategories: [
      { name: 'Chest X-Ray (PA View)', price: 1500, turnaround: '1 hour', description: 'Digital X-ray of chest and lungs' },
      { name: 'Abdominal Ultrasound', price: 2200, turnaround: '2 hours', description: 'Organs of the abdomen scan' },
      { name: 'CT Scan (Without Contrast)', price: 5500, turnaround: '4 hours', description: 'Cross-sectional body imaging' },
    ],
  },
  'Cardiac Tests': {
    icon: '❤️',
    description: 'Heart health assessment',
    subcategories: [
      { name: 'Electrocardiogram (ECG)', price: 1100, turnaround: '30 min', description: '12-lead ECG with report' },
      { name: 'Echocardiogram (2D Echo)', price: 3200, turnaround: '2 hours', description: 'Ultrasound of the heart' },
      { name: 'Treadmill Stress Test (TMT)', price: 2800, turnaround: '3 hours', description: 'Exercise stress ECG test' },
    ],
  },
  'Liver Function Tests': {
    icon: '🫀',
    description: 'Hepatic panel assessment',
    subcategories: [
      { name: 'Liver Function Test (LFT)', price: 900, turnaround: '6 hours', description: 'Complete liver enzyme panel' },
      { name: 'Hepatitis B Surface Antigen', price: 600, turnaround: '4 hours', description: 'HBsAg screening' },
      { name: 'Hepatitis C Antibody', price: 700, turnaround: '4 hours', description: 'Anti-HCV screening test' },
    ],
  },
  'Thyroid Tests': {
    icon: '🦋',
    description: 'Thyroid gland function',
    subcategories: [
      { name: 'TSH (Thyroid Stimulating Hormone)', price: 650, turnaround: '6 hours', description: 'Primary thyroid function screening' },
      { name: 'T3 & T4 (Triiodothyronine & Thyroxine)', price: 900, turnaround: '6 hours', description: 'Free and total thyroid hormones' },
      { name: 'Anti-TPO Antibody', price: 1100, turnaround: '24 hours', description: 'Thyroid autoimmune screening' },
    ],
  },
  'Hormone Tests': {
    icon: '⚗️',
    description: 'Endocrine system analysis',
    subcategories: [
      { name: 'Testosterone (Total & Free)', price: 1000, turnaround: '24 hours', description: 'Male hormone panel' },
      { name: 'Oestradiol (E2) & FSH', price: 1100, turnaround: '24 hours', description: 'Female hormone panel' },
      { name: 'Cortisol (Morning & Evening)', price: 1300, turnaround: '6 hours', description: 'Adrenal function and stress hormone' },
    ],
  },
  'Stool Tests': {
    icon: '🧬',
    description: 'Gastrointestinal analysis',
    subcategories: [
      { name: 'Stool Routine & Microscopy', price: 380, turnaround: '4 hours', description: 'Physical and microscopic stool examination' },
      { name: 'Stool Culture & Sensitivity', price: 550, turnaround: '48 hours', description: 'Bacterial pathogens in stool' },
      { name: 'Occult Blood Test (FOB)', price: 420, turnaround: '2 hours', description: 'Hidden blood detection in stool' },
    ],
  },
  'Allergy Tests': {
    icon: '🌿',
    description: 'Allergen-specific testing',
    subcategories: [
      { name: 'Food Allergy Panel (20 allergens)', price: 2200, turnaround: '24 hours', description: 'Common food allergens IgE panel' },
      { name: 'Respiratory Allergy Panel', price: 2600, turnaround: '24 hours', description: 'Pollen, dust, mold, animal dander' },
      { name: 'Total IgE & Specific IgE', price: 1600, turnaround: '24 hours', description: 'General allergy marker and specific triggers' },
    ],
  },
  'Cancer Marker Tests': {
    icon: '🔭',
    description: 'Tumour marker screening',
    subcategories: [
      { name: 'PSA (Prostate Specific Antigen)', price: 1600, turnaround: '6 hours', description: 'Prostate cancer screening' },
      { name: 'CA-125 (Ovarian Cancer Marker)', price: 2100, turnaround: '24 hours', description: 'Ovarian tumour marker' },
      { name: 'AFP & CEA Panel', price: 2400, turnaround: '24 hours', description: 'Liver, colorectal cancer markers' },
    ],
  },
};

// Helper: get next token for lab tests on a date
const getNextLabToken = async (dateStr) => {
  const start = new Date(dateStr + 'T00:00:00.000Z');
  const end = new Date(dateStr + 'T23:59:59.999Z');
  const count = await LabTest.countDocuments({
    scheduledDate: { $gte: start, $lte: end },
    status: { $nin: ['cancelled'] },
  });
  return 'L' + String(count + 1).padStart(3, '0');
};

// Helper: auto-expire past lab tests
const expirePastLabTests = async () => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const todayStart = new Date(todayStr + 'T00:00:00.000Z');

  await LabTest.updateMany(
    { scheduledDate: { $lt: todayStart }, status: 'scheduled' },
    { status: 'expired' }
  );

  const todayTests = await LabTest.find({
    scheduledDate: { $gte: todayStart },
    status: 'scheduled',
  });

  for (const test of todayTests) {
    const [h, m] = test.scheduledTime.split(':').map(Number);
    const testDateTime = new Date(test.scheduledDate);
    testDateTime.setUTCHours(h, m + 30, 0, 0);
    if (now > testDateTime) {
      test.status = 'expired';
      await test.save();
    }
  }
};

// @route GET /api/lab-tests/catalog
router.get('/catalog', (req, res) => {
  res.json(LAB_CATALOG);
});

// @route POST /api/lab-tests
// @access Patient
router.post('/', authorize('patient'), async (req, res) => {
  try {
    const { testCategory, testName, subCategory, scheduledDate, scheduledTime, amount } =
      req.body;

    if (!testCategory || !subCategory || !scheduledDate || !scheduledTime || !amount) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const testDateTime = new Date(`${scheduledDate}T${scheduledTime}:00`);
    if (testDateTime < new Date()) {
      return res.status(400).json({ message: 'Cannot book tests in the past' });
    }

    const tokenNumber = await getNextLabToken(scheduledDate);

    const labTest = await LabTest.create({
      patient: req.user._id,
      testCategory,
      testName: testName || testCategory,
      subCategory,
      scheduledDate: new Date(scheduledDate),
      scheduledTime,
      amount: Number(amount),
      tokenNumber,
      status: 'scheduled',
    });

    res.status(201).json(labTest);
  } catch (err) {
    console.error('Book lab test error:', err);
    res.status(500).json({ message: err.message });
  }
});

// @route GET /api/lab-tests/my
// @access Patient
router.get('/my', authorize('patient'), async (req, res) => {
  try {
    await expirePastLabTests();
    const tests = await LabTest.find({ patient: req.user._id })
      .populate('technician', 'name email')
      .sort({ scheduledDate: -1, createdAt: -1 });
    res.json(tests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route GET /api/lab-tests/all
// @access Lab Technician, Admin
router.get('/all', authorize('lab_technician', 'admin'), async (req, res) => {
  try {
    await expirePastLabTests();
    const tests = await LabTest.find()
      .populate('patient', 'name phone email gender bloodGroup dateOfBirth')
      .populate('technician', 'name')
      .sort({ scheduledDate: 1, scheduledTime: 1 });
    res.json(tests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route PATCH /api/lab-tests/:id/result
// @access Lab Technician, Admin
router.patch('/:id/result', authorize('lab_technician', 'admin'), async (req, res) => {
  try {
    const test = await LabTest.findById(req.params.id).populate('patient', 'name');
    if (!test) return res.status(404).json({ message: 'Lab test not found' });

    if (test.status === 'completed') {
      return res.status(400).json({ message: 'Results already uploaded for this test' });
    }

    // Check time – patient must not be more than 30 min late
    const [h, m] = test.scheduledTime.split(':').map(Number);
    const testDateTime = new Date(test.scheduledDate);
    testDateTime.setUTCHours(h, m, 0, 0);
    const deadline = new Date(testDateTime.getTime() + 30 * 60 * 1000);
    const now = new Date();

    if (now > deadline && test.status === 'scheduled') {
      test.status = 'expired';
      await test.save();
      return res.status(400).json({
        message: 'Test time has expired. Patient was late – cannot upload results.',
      });
    }

    const { notes, parameters } = req.body;

    test.results = {
      notes: notes || '',
      parameters: parameters || [],
      uploadedAt: now,
      reportData: req.body.reportData || null,
    };
    test.technician = req.user._id;
    test.status = 'completed';
    if (test.paymentStatus === 'pending') {
      test.paymentStatus = 'paid'; // Mark as paid when results uploaded (cash at lab)
    }
    await test.save();

    const populated = await LabTest.findById(test._id)
      .populate('patient', 'name phone email')
      .populate('technician', 'name');

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route PATCH /api/lab-tests/:id/pay
// @access Lab Technician, Admin
router.patch('/:id/pay', authorize('lab_technician', 'admin'), async (req, res) => {
  try {
    const test = await LabTest.findByIdAndUpdate(
      req.params.id,
      { paymentStatus: 'paid' },
      { new: true }
    );
    if (!test) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Payment recorded', test });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route PATCH /api/lab-tests/:id/cancel
// @access Patient, Admin
router.patch('/:id/cancel', async (req, res) => {
  try {
    const test = await LabTest.findById(req.params.id);
    if (!test) return res.status(404).json({ message: 'Not found' });
    if (
      req.user.role !== 'admin' &&
      test.patient.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    test.status = 'cancelled';
    await test.save();
    res.json({ message: 'Lab test cancelled' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
