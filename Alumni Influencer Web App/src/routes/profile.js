// src/routes/profile.js
// Profile management routes
// All routes require JWT authentication (Security Layer: verifyToken)

const express    = require('express');
const multer     = require('multer');
const path       = require('path');
const { body }   = require('express-validator');
const router     = express.Router();
const { verifyToken }    = require('../security/auth');
const profileController  = require('../controllers/profileController');

// Multer setup for local disk storage of profile images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Save to /uploads folder
  },
  filename: (req, file, cb) => {
    // Unique filename: userId-timestamp.ext  (avoids name collisions)
    const ext = path.extname(file.originalname);
    cb(null, `profile-${req.user.id}-${Date.now()}${ext}`);
  },
});

// Only allow image files (input validation for uploads)
const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpg, png, gif, webp).'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB
});

// Validation rules

// URL validator helper — used for LinkedIn, degree URL, cert URL etc.
const isValidUrl = body('linkedin_url')
  .optional()
  .isURL({ require_protocol: true })
  .withMessage('Must be a valid URL starting with http:// or https://');

const profileValidation = [
  body('first_name').trim().notEmpty().withMessage('First name is required.'),
  body('last_name').trim().notEmpty().withMessage('Last name is required.'),
  body('biography').optional().trim(),
  body('linkedin_url').optional().isURL({ require_protocol: true }).withMessage('LinkedIn URL must be valid.'),
];

const degreeValidation = [
  body('title').trim().notEmpty().withMessage('Degree title is required.'),
  body('institution').optional().trim(),
  body('degree_url').optional().isURL({ require_protocol: true }).withMessage('Degree URL must be valid.'),
  body('completion_date').optional().isDate().withMessage('Invalid date format. Use YYYY-MM-DD.'),
];

const certValidation = [
  body('title').trim().notEmpty().withMessage('Certification title is required.'),
  body('cert_url').optional().isURL({ require_protocol: true }).withMessage('Cert URL must be valid.'),
  body('completion_date').optional().isDate().withMessage('Invalid date format. Use YYYY-MM-DD.'),
];

const licenceValidation = [
  body('title').trim().notEmpty().withMessage('Licence title is required.'),
  body('awarding_body').optional().trim(),
  body('licence_url').optional().isURL({ require_protocol: true }).withMessage('Licence URL must be valid.'),
  body('completion_date').optional().isDate().withMessage('Invalid date format. Use YYYY-MM-DD.'),
];

const courseValidation = [
  body('title').trim().notEmpty().withMessage('Course title is required.'),
  body('course_url').optional().isURL({ require_protocol: true }).withMessage('Course URL must be valid.'),
  body('completion_date').optional().isDate().withMessage('Invalid date format. Use YYYY-MM-DD.'),
];

const employmentValidation = [
  body('company').trim().notEmpty().withMessage('Company name is required.'),
  body('role').trim().notEmpty().withMessage('Job role is required.'),
  body('start_date').isDate().withMessage('Start date is required (YYYY-MM-DD).'),
  body('end_date').optional().isDate().withMessage('End date must be valid (YYYY-MM-DD).'),
];

// Profile routes

/**
 * @swagger
 * /api/profile/me:
 *   get:
 *     tags: [Profile]
 *     summary: Get my full profile
 *     security:
 *       - AlumniJWT: []
 *     description: '**Auth required:** `Authorization: Bearer <JWT>` — Returns the full profile including all qualifications and employment history.'
 *     responses:
 *       200:
 *         description: Full profile data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FullProfileResponse'
 *       401:
 *         description: Missing or invalid JWT token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   put:
 *     tags: [Profile]
 *     summary: Update basic personal info
 *     description: '**Auth required:** `Authorization: Bearer <JWT>`'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProfileUpdate'
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Auth required
 */
router.get('/me', verifyToken, profileController.getMyProfile);
router.put('/me', verifyToken, profileValidation, profileController.updateProfile);

/**
 * @swagger
 * /api/profile/me/linkedin:
 *   patch:
 *     tags: [Profile]
 *     summary: Update LinkedIn URL
 *     security:
 *       - AlumniJWT: []
 *     description: '**Auth required:** `Authorization: Bearer <JWT>` — Direct mapping to the "Update LinkedIn URL" use case.'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               linkedin_url: { type: string, example: 'https://linkedin.com/in/alumni' }
 *     responses:
 *       200:
 *         description: LinkedIn URL updated
 */
router.patch('/me/linkedin', verifyToken, isValidUrl, profileController.updateLinkedIn);

/**
 * @swagger
 * /api/profile/me/completion:
 *   get:
 *     tags: [Profile]
 *     summary: Get profile completion status
 *     security:
 *       - AlumniJWT: []
 *     description: >
 *       **Auth required:** `Authorization: Bearer <JWT>`
 *
 *       Returns a weighted completion percentage (0–100) broken down by
 *       section. Each section indicates whether it is complete and, if not,
 *       provides a hint describing what needs to be filled in.
 *
 *       | Section | Weight |
 *       |---|---|
 *       | Name (first + last) | 20 pts |
 *       | Biography (20+ chars) | 15 pts |
 *       | LinkedIn URL | 10 pts |
 *       | Profile Photo | 15 pts |
 *       | Degrees (≥1) | 15 pts |
 *       | Employment (≥1) | 15 pts |
 *       | Certs / Licences / Courses (any) | 10 pts |
 *     responses:
 *       200:
 *         description: Profile completion breakdown
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 percent: { type: integer, example: 75 }
 *                 label: { type: string, example: 'Good' }
 *                 sections:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       key: { type: string }
 *                       label: { type: string }
 *                       weight: { type: integer }
 *                       complete: { type: boolean }
 *                       hint: { type: string, nullable: true }
 *                 missing:
 *                   type: array
 *                   items: { type: string }
 *       401:
 *         description: Auth required
 */
router.get('/me/completion', verifyToken, profileController.getCompletionStatus);

/**
 * @swagger
 * /api/profile/me/image:
 *   post:
 *     tags: [Profile]
 *     summary: Upload profile photo (max 5MB, JPG/PNG/GIF/WEBP)
 *     security:
 *       - AlumniJWT: []
 *     description: '**Auth required:** `Authorization: Bearer <JWT>` — Stores image to `/uploads/` and saves path to profile.'
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Max 5MB. Accepted formats — jpeg, png, gif, webp.
 *     responses:
 *       200:
 *         description: Image uploaded and profile updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Invalid file type or size exceeded
 *       401:
 *         description: Auth required
 */
router.post('/me/image', verifyToken, upload.single('image'), profileController.uploadImage);

/**
 * @swagger
 * /api/profile/{id}:
 *   get:
 *     tags: [Profile]
 *     summary: Get profile by user ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Public profile data
 */
router.get('/:id', profileController.getProfile);

// Degrees
/**
 * @swagger
 * /api/profile/me/degrees:
 *   post:
 *     tags: [Profile]
 *     summary: Add a degree to your profile
 *     security:
 *       - AlumniJWT: []
 *     description: '**Auth required:** `Authorization: Bearer <JWT>`'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DegreeRequest'
 *     responses:
 *       201:
 *         description: Degree added successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Auth required
 */
router.post('/me/degrees',       verifyToken, degreeValidation,  profileController.addDegree);
router.put('/me/degrees/:id',    verifyToken, degreeValidation,  profileController.updateDegree);
router.delete('/me/degrees/:id', verifyToken,                    profileController.deleteDegree);

// Certifications
/**
 * @swagger
 * /api/profile/me/certifications:
 *   post:
 *     tags: [Profile]
 *     summary: Add a professional certification
 *     security:
 *       - AlumniJWT: []
 *     description: '**Auth required:** `Authorization: Bearer <JWT>`'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string, example: 'AWS Solutions Architect' }
 *               cert_url: { type: string, example: 'https://aws.amazon.com/verify/123' }
 *               completion_date: { type: string, format: date, example: '2023-05-20' }
 *     responses:
 *       201:
 *         description: Certification added
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 */
router.post('/me/certifications',       verifyToken, certValidation, profileController.addCertification);
router.put('/me/certifications/:id',    verifyToken, certValidation, profileController.updateCertification);
router.delete('/me/certifications/:id', verifyToken,                 profileController.deleteCertification);

// Licences
router.post('/me/licences',       verifyToken, licenceValidation, profileController.addLicence);
router.put('/me/licences/:id',    verifyToken, licenceValidation, profileController.updateLicence);
router.delete('/me/licences/:id', verifyToken,                    profileController.deleteLicence);

// Short courses
router.post('/me/courses',       verifyToken, courseValidation, profileController.addCourse);
router.put('/me/courses/:id',    verifyToken, courseValidation, profileController.updateCourse);
router.delete('/me/courses/:id', verifyToken,                   profileController.deleteCourse);

// Employment
/**
 * @swagger
 * /api/profile/me/employment:
 *   post:
 *     tags: [Profile]
 *     summary: Add an employment history record
 *     security:
 *       - AlumniJWT: []
 *     description: '**Auth required:** `Authorization: Bearer <JWT>` — Leave `end_date` empty if currently employed here.'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [company, role, start_date]
 *             properties:
 *               company: { type: string, example: 'Google DeepMind' }
 *               role: { type: string, example: 'Senior Software Engineer' }
 *               start_date: { type: string, format: date, example: '2021-09-01' }
 *               end_date: { type: string, format: date, example: '2024-03-31', description: 'Leave blank if current job' }
 *     responses:
 *       201:
 *         description: Employment record added
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Auth required
 */
router.post('/me/employment',       verifyToken, employmentValidation, profileController.addEmployment);
router.put('/me/employment/:id',    verifyToken, employmentValidation, profileController.updateEmployment);
router.delete('/me/employment/:id', verifyToken,                       profileController.deleteEmployment);

module.exports = router;
