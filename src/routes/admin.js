// src/routes/admin.js
// Admin routes for API token management
// Protected by JWT — must be logged in as a developer to manage tokens

const express    = require('express');
const { body }   = require('express-validator');
const router     = express.Router();
const { verifyToken }  = require('../security/auth');
const adminController  = require('../controllers/adminController');

/**
 * @swagger
 * /api/admin/tokens:
 *   post:
 *     tags: [Admin]
 *     summary: Generate a new API key (Developer only)
 *     security:
 *       - AlumniJWT: []
 *     description: '**Auth required:** `Authorization: Bearer <Developer-JWT>` — Generates a cryptographically secure 64-character hex token. The raw token is shown **once only** and is never stored. SHA-256 hash is stored in the database.'
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token_name:
 *                 type: string
 *                 example: AR App Production
 *                 description: Human-readable label for this key (max 100 characters)
 *     responses:
 *       201:
 *         description: Token generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TokenResponse'
 *       401:
 *         description: Auth required
 *       403:
 *         description: Developer role required
 *   get:
 *     tags: [Admin]
 *     summary: List all your API keys
 *     security:
 *       - AlumniJWT: []
 *     description: '**Auth required:** `Authorization: Bearer <Developer-JWT>` — Returns metadata only. Raw tokens are never retrievable.'
 *     responses:
 *       200:
 *         description: List of tokens with usage counts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 tokens:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       token_name: { type: string, example: 'AR App' }
 *                       is_revoked: { type: boolean }
 *                       created_at: { type: string, format: date-time }
 *                       last_used_at: { type: string, format: date-time, nullable: true }
 *                       total_requests: { type: integer, example: 42 }
 *       401:
 *         description: Auth required
 */
router.post('/tokens',
  [body('token_name').optional().trim().isLength({ max: 100 }).withMessage('Token name max 100 chars.')],
  adminController.generateToken
);

router.get('/tokens',
  adminController.listTokens
);

/**
 * @swagger
 * /api/admin/tokens/{id}/usage:
 *   get:
 *     tags: [Admin]
 *     summary: View usage logs for a specific token
 *     security:
 *       - AlumniJWT: []
 *     description: '**Auth required:** `Authorization: Bearer <Developer-JWT>` — Returns top endpoints accessed, total request count, and the 100 most recent call logs.'
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The token ID to inspect
 *     responses:
 *       200:
 *         description: Token usage statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 token: { type: object }
 *                 summary:
 *                   type: object
 *                   properties:
 *                     total_requests: { type: integer }
 *                     top_endpoints: { type: array, items: { type: object } }
 *                 recent_logs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       endpoint: { type: string, example: 'GET /featured' }
 *                       ip_address: { type: string, example: '::1' }
 *                       accessed_at: { type: string, format: date-time }
 *       404:
 *         description: Token not found
 */
router.get('/tokens/:id/usage',
  adminController.getTokenUsage
);

/**
 * @swagger
 * /api/admin/tokens/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Revoke an API token immediately
 *     security:
 *       - AlumniJWT: []
 *     description: '**Auth required:** `Authorization: Bearer <Developer-JWT>` — Once revoked, any request using this token will be immediately rejected with 401. This action is irreversible.'
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Token revoked successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Token not found or does not belong to you
 */
router.delete('/tokens/:id',
  adminController.revokeToken
);

/**
 * @swagger
 * /api/admin/alumni/{id}/grant-bonus:
 *   post:
 *     tags: [Admin]
 *     summary: Grant an alumnus their 4th monthly win slot
 *     security:
 *       - AlumniJWT: []
 *     description: '**Auth required:** `Authorization: Bearer <Developer-JWT>` — Sets `has_event_participation = true` on the alumni profile. This is awarded to alumni who have attended a university event. The effect applies from the current month onwards.'
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The user ID of the alumnus to grant the bonus to
 *     responses:
 *       200:
 *         description: 4th win slot granted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Target user is not an alumnus
 *       401:
 *         description: Auth required
 */
router.post('/alumni/:id/grant-bonus',
  adminController.grantFourthWin
);

/**
 * @swagger
 * /api/admin/alumni/win-stats:
 *   get:
 *     tags: [Admin]
 *     summary: List all alumni with their monthly win counts
 *     security:
 *       - AlumniJWT: []
 *     description: '**Auth required:** `Authorization: Bearer <Developer-JWT>` — Returns all alumni users with current month win count, remaining slots, and event participation status.'
 *     responses:
 *       200:
 *         description: List of alumni win statistics for the current month
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 stats:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       email: { type: string }
 *                       first_name: { type: string }
 *                       last_name: { type: string }
 *                       has_event_participation: { type: boolean }
 *                       win_count: { type: integer, example: 2 }
 *       401:
 *         description: Auth required
 */
router.get('/alumni/win-stats',
  adminController.listAlumniWinStats
);

/**
 * @swagger
 * /api/admin/monthly-reset:
 *   post:
 *     tags: [Admin]
 *     summary: Manually trigger the monthly win count reset
 *     security:
 *       - AlumniJWT: []
 *     description: >
 *       **Auth required:** `Authorization: Bearer <Developer-JWT>`
 *
 *       Executes the same monthly reset logic that the scheduler fires
 *       automatically at Midnight on the 1st of each month. Resets all
 *       `monthly_wins.win_count` values for the previous calendar month
 *       back to 0. Rows are preserved for historical queries — only the
 *       count is zeroed. Use for testing or emergency resets.
 *     responses:
 *       200:
 *         description: Monthly reset executed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Auth required
 */
router.post('/monthly-reset',
  adminController.triggerMonthlyReset
);


module.exports = router;
