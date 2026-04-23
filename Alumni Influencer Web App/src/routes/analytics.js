const express = require('express');
const router = express.Router();
const { verifyApiToken, requirePermission } = require('../security/auth');
const analyticsController = require('../controllers/analyticsController');

/**
 * @swagger
 * /api/analytics/skills-gap:
 *   get:
 *     tags: [Analytics]
 *     summary: Get Skills Gap telemetry
 *     security:
 *       - AnalyticsDashboardAuth: []
 *     description: Returns consolidated demand metrics for Certifications, Courses, and Licences. Filterable by programme/gradYear.
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/skills-gap',            verifyApiToken, requirePermission('read:analytics'), analyticsController.skillsGap);

/**
 * @swagger
 * /api/analytics/employment-by-industry:
 *   get:
 *     tags: [Analytics]
 *     summary: Get Employment by Industry sectors
 *     security:
 *       - AnalyticsDashboardAuth: []
 *     description: Aggregated Pie chart metrics grouping alumni employment into major sectors.
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/employment-by-industry',verifyApiToken, requirePermission('read:analytics'), analyticsController.employmentByIndustry);

/**
 * @swagger
 * /api/analytics/top-job-titles:
 *   get:
 *     tags: [Analytics]
 *     summary: Top Job Titles metrics
 *     security:
 *       - AnalyticsDashboardAuth: []
 *     description: Returns top alumni job titles.
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/top-job-titles',        verifyApiToken, requirePermission('read:analytics'), analyticsController.topJobTitles);

/**
 * @swagger
 * /api/analytics/top-employers:
 *   get:
 *     tags: [Analytics]
 *     summary: Top Employers metrics
 *     security:
 *       - AnalyticsDashboardAuth: []
 *     description: Returns ranking of maximum employment hubs.
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/top-employers',         verifyApiToken, requirePermission('read:analytics'), analyticsController.topEmployers);

/**
 * @swagger
 * /api/analytics/geographic:
 *   get:
 *     tags: [Analytics]
 *     summary: Geographic distribution
 *     security:
 *       - AnalyticsDashboardAuth: []
 *     description: Returns proxy location mappings via employer distributions.
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/geographic',            verifyApiToken, requirePermission('read:analytics'), analyticsController.geographic);

/**
 * @swagger
 * /api/analytics/graduation-trends:
 *   get:
 *     tags: [Analytics]
 *     summary: Historical graduation trends
 *     security:
 *       - AnalyticsDashboardAuth: []
 *     description: Time-series vector indicating volume of degrees awarded per year globally.
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/graduation-trends',     verifyApiToken, requirePermission('read:analytics'), analyticsController.graduationTrends);

module.exports = router;
