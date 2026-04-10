// src/routes/auth.js
// Authentication routes with express-validator input validation

const path = require('path');
const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const authController = require('../controllers/authController');

// Validation rules for registration
const registerValidation = [
  body('email')
    .isEmail().withMessage('Please provide a valid email address.')
    .normalizeEmail()
    .matches(/@.*(ac\.uk|edu|ac\.lk|phantasmagoria\.com)$/)
    .withMessage('Only university emails (.ac.uk, .edu, .ac.lk, or @phantasmagoria.com) are allowed.'),

  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
    .matches(/[0-9]/).withMessage('Password must contain at least one number.')
    .matches(/[!@#$%^&*]/).withMessage('Password must contain at least one special character (!@#$%^&*).'),
];

// Validation rules for login
const loginValidation = [
  body('email').isEmail().withMessage('Valid email required.').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required.'),
];

// Validation for password reset
const resetValidation = [
  body('token').notEmpty().withMessage('Reset token is required.'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
    .matches(/[0-9]/).withMessage('Password must contain at least one number.')
    .matches(/[!@#$%^&*]/).withMessage('Password must contain at least one special character (!@#$%^&*).'),
];

// Authentication routes

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new alumni
 *     description: Creates account and sends verification email. Only university emails accepted.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Registration successful, verification email sent
 *       400:
 *         description: Validation error (invalid email/password)
 *       409:
 *         description: Email already registered
 */

// POST /api/auth/register
router.post('/register', registerValidation, authController.register);

/**
 * @swagger
 * /api/auth/verify-email:
 *   get:
 *     tags: [Auth]
 *     summary: Verify email address
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Email successfully verified
 *       400:
 *         description: Invalid or expired token
 */
router.get('/verify-email', authController.verifyEmail);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login to alumni account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful, returns JWT
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Email not verified
 */
router.post('/login', loginValidation, authController.login);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout of current session
 *     security:
 *       - AlumniJWT: []
 *     responses:
 *       200:
 *         description: Successfully logged out
 */
router.post('/logout', authController.logout);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request password reset email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 example: alumni@gmail.com
 *     responses:
 *       200:
 *         description: Reset email sent (if email exists)
 */
router.post('/forgot-password', [
  body('email').isEmail().withMessage('Valid email required.').normalizeEmail(),
], authController.forgotPassword);

/**
 * @swagger
 * /api/auth/reset-password:
 *   get:
 *     tags: [Auth]
 *     summary: View the password reset page
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Serves the reset password page
 *   post:
 *     tags: [Auth]
 *     summary: Reset password using email token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password updated successfully
 *       400:
 *         description: Invalid or expired token
 */
router.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/reset-password.html'));
});

router.post('/reset-password', resetValidation, authController.resetPassword);

module.exports = router;
