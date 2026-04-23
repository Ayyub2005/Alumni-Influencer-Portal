const express       = require('express');
const router        = express.Router();
const requireLogin  = require('../middleware/requireLogin');
const dashboard     = require('../controllers/dashboardController');

const { query, validationResult } = require('express-validator');

const validateFilter = [
  query('programme').optional().isString().trim().escape(),
  query('gradYear').optional().isInt({ min: 1900, max: 2100 }).escape(),
  query('industry').optional().isString().trim().escape(),
  query('n').optional().isInt({ min: 1, max: 100 }).escape(),
  query('page').optional().isInt({ min: 1 }).escape(),
  query('limit').optional().isInt({ min: 1, max: 100 }).escape(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    next();
  }
];

// All dashboard routes require the user to be logged into CW2 and go through XSS sanitization
router.get('/alumni',                requireLogin, validateFilter, dashboard.getAlumni);
router.get('/skills-gap',            requireLogin, validateFilter, dashboard.getSkillsGap);
router.get('/employment-by-industry',requireLogin, validateFilter, dashboard.getEmploymentByIndustry);
router.get('/top-job-titles',        requireLogin, validateFilter, dashboard.getTopJobTitles);
router.get('/top-employers',         requireLogin, validateFilter, dashboard.getTopEmployers);
router.get('/geographic',            requireLogin, dashboard.getGeographic);
router.get('/graduation-trends',     requireLogin, dashboard.getGraduationTrends);
router.get('/permission-demo',       requireLogin, dashboard.permissionDemo);

module.exports = router;
