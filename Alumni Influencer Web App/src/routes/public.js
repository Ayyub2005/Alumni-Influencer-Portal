// Public API routes
// Uses API tokens instead of the alumni login
// This is for the AR client or other public developers

const express    = require('express');
const router     = express.Router();
const { verifyApiToken } = require('../security/auth');
const publicController   = require('../controllers/publicController');

/**
 * @swagger
 * /api/public/featured:
 *   get:
 *     tags: [Public Developer API]
 *     summary: Get today's featured alumni
 *     security:
 *       - MobileArAppAuth: []
 *     description: >
 *       **Auth required:** `Authorization: Bearer <API-TOKEN>` — Returns the full professional profile of the winner of the previous day's bidding cycle. The winner is selected at Midnight and becomes today's "Alumni of the Day". If no winner was selected, returns `featured: null`.
 *     responses:
 *       200:
 *         description: Success - Full professional profile returned
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FeaturedAlumniResponse'
 *       401:
 *         description: Invalid or revoked API token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/featured', verifyApiToken, publicController.getFeaturedAlumni);

/**
 * @swagger
 * /api/public/alumni:
 *   get:
 *     tags: [Public Developer API]
 *     summary: List all alumni (Directory)
 *     security:
 *       - AnalyticsDashboardAuth: []
 *     description: '**Auth required:** `Authorization: Bearer <API-TOKEN>` — Returns a paginated list of all verified alumni profiles. Useful for building directory-style interfaces in the AR app.'
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/alumni', verifyApiToken, publicController.listAlumni);

/**
 * @swagger
 * /api/public/alumni/{id}:
 *   get:
 *     tags: [Public Developer API]
 *     summary: Get alumni details by ID
 *     security:
 *       - AnalyticsDashboardAuth: []
 *     description: '**Auth required:** `Authorization: Bearer <API-TOKEN>` — Returns the full professional profile for a specific alumni ID.'
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: Alumni not found
 */
router.get('/alumni/:id', verifyApiToken, publicController.getPublicProfile);

module.exports = router;
