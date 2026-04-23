const express = require('express');
const router  = express.Router();
const { body } = require('express-validator');
const auth = require('../controllers/authController');

const registerValidation = [
  body('email').isEmail().withMessage('Valid email required.').normalizeEmail().escape(),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
    .matches(/[0-9]/).withMessage('Password must contain at least one number.')
    .matches(/[!@#$%^&*]/).withMessage('Password must contain at least one special character (!@#$%^&*).')
    .escape(),
];

const loginValidation = [
  body('email').isEmail().withMessage('Valid email required.').normalizeEmail().escape(),
  body('password').notEmpty().withMessage('Password is required.').escape(),
];

const forgotValidation = [
  body('email').isEmail().withMessage('Valid email required.').normalizeEmail().escape(),
];

const resetValidation = [
  body('token').notEmpty().withMessage('Token required.').escape(),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
    .matches(/[0-9]/).withMessage('Password must contain at least one number.')
    .matches(/[!@#$%^&*]/).withMessage('Password must contain at least one special character (!@#$%^&*).')
    .escape(),
];

router.post('/register', registerValidation, auth.register);
router.get('/verify-email', auth.verifyEmail);
router.post('/login', loginValidation, auth.login);
router.post('/logout', auth.logout);
router.post('/forgot-password', forgotValidation, auth.forgotPassword);
router.post('/reset-password', resetValidation, auth.resetPassword);
router.get('/me', auth.me);

module.exports = router;
