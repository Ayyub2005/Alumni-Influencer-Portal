// src/routes/bids.js
// Bidding system routes
// All require JWT authentication

const express        = require('express');
const { body }       = require('express-validator');
const router         = express.Router();
const { verifyToken } = require('../security/auth');
const bidController   = require('../controllers/bidController');

// Bid amount validation
const bidValidation = [
  body('amount')
    .isFloat({ min: 0.01 }).withMessage('Bid amount must be a positive number greater than 0.')
    .toFloat(),
];

/**
 * @swagger
 * /api/bids:
 *   post:
 *     tags: [Bids]
 *     summary: Place a new blind bid for the day
 *     security:
 *       - AlumniJWT: []
 *     description: '**Auth required:** `Authorization: Bearer <JWT>` — You may only have one active bid per day. Bid amount must be positive.'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BidRequest'
 *     responses:
 *       201:
 *         description: Bid placed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Already have an active bid today — use PATCH to increase
 *       403:
 *         description: Monthly win limit reached (3 wins standard, 4 with event participation)
 *       401:
 *         description: Auth required
 */
router.post('/', verifyToken, bidValidation, bidController.placeBid);

/**
 * @swagger
 * /api/bids/{id}:
 *   patch:
 *     tags: [Bids]
 *     summary: Increase an existing active bid
 *     security:
 *       - AlumniJWT: []
 *     description: '**Auth required:** `Authorization: Bearer <JWT>` — The new amount must be strictly greater than your current bid. Bids can only go up.'
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The bid ID to increase
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BidRequest'
 *     responses:
 *       200:
 *         description: Bid increased successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: New amount is not greater than current bid
 *       404:
 *         description: Bid not found or does not belong to you
 *       401:
 *         description: Auth required
 */
router.patch('/:id', verifyToken, bidValidation, bidController.updateBid);

/**
 * @swagger
 * /api/bids/status:
 *   get:
 *     tags: [Bids]
 *     summary: Check your current bid status for today
 *     security:
 *       - AlumniJWT: []
 *     description: '**Auth required:** `Authorization: Bearer <JWT>` — Returns Win/Loss status only. The highest bid amount is never exposed to preserve blind auction integrity.'
 *     responses:
 *       200:
 *         description: Current bid status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BidStatusResponse'
 *       401:
 *         description: Auth required
 */
router.get('/status', verifyToken, bidController.getBidStatus);

/**
 * @swagger
 * /api/bids/history:
 *   get:
 *     tags: [Bids]
 *     summary: Get your full bid history
 *     security:
 *       - AlumniJWT: []
 *     description: '**Auth required:** `Authorization: Bearer <JWT>` — Returns all past bids with date, amount, and outcome.'
 *     responses:
 *       200:
 *         description: Array of historical bids
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 bids:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       amount: { type: number, example: 150.00 }
 *                       bid_date: { type: string, format: date }
 *                       status: { type: string, enum: [active, won, lost] }
 *                       is_winner: { type: boolean }
 *       401:
 *         description: Auth required
 */
router.get('/history', verifyToken, bidController.getBidHistory);

/**
 * @swagger
 * /api/bids/tomorrow:
 *   get:
 *     tags: [Bids]
 *     summary: View tomorrow's bidding slot details
 *     security:
 *       - AlumniJWT: []
 *     description: >
 *       **Auth required:** `Authorization: Bearer <JWT>`
 *
 *       Returns the date and full schedule of tomorrow's bidding window
 *       (00:00 – 23:59 Asia/Colombo), the Midnight cutoff time when the
 *       winner is selected, and the authenticated user's eligibility status
 *       based on their current monthly win standing.
 *     responses:
 *       200:
 *         description: Tomorrow's slot details and user eligibility
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 slot:
 *                   type: object
 *                   properties:
 *                     date:
 *                       type: string
 *                       format: date
 *                       example: "2026-04-10"
 *                     bidding_opens:
 *                       type: string
 *                       example: "2026-04-10T00:00:00+05:30"
 *                     bidding_closes:
 *                       type: string
 *                       example: "2026-04-10T23:59:59+05:30"
 *                     winner_selected:
 *                       type: string
 *                       example: "2026-04-10T00:00:00+05:30 (next day — Midnight cutoff)"
 *                     timezone:
 *                       type: string
 *                       example: "Asia/Colombo"
 *                     description:
 *                       type: string
 *                 eligibility:
 *                   type: object
 *                   properties:
 *                     can_bid:
 *                       type: boolean
 *                     reason:
 *                       type: string
 *                     monthly_wins_used:
 *                       type: integer
 *                     monthly_wins_max:
 *                       type: integer
 *                     wins_remaining:
 *                       type: integer
 *                     event_bonus_active:
 *                       type: boolean
 *       401:
 *         description: Auth required
 */
router.get('/tomorrow', verifyToken, bidController.getTomorrowSlot);

/**
 * @swagger
 * /api/bids/{id}:
 *   delete:
 *     tags: [Bids]
 *     summary: Cancel an active bid placed today
 *     security:
 *       - AlumniJWT: []
 *     description: >
 *       **Auth required:** `Authorization: Bearer <JWT>`
 *
 *       Permanently removes the authenticated user's active bid for the
 *       current day. Only bids with status `active` and `bid_date` equal to
 *       today can be cancelled. Bids that have already been resolved as
 *       `won` or `lost` by the Midnight scheduler are final and cannot be
 *       withdrawn. A new bid may be placed after cancellation.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the bid to cancel
 *     responses:
 *       200:
 *         description: Bid cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                 cancelled_bid_id:
 *                   type: integer
 *                 cancelled_bid_amount:
 *                   type: number
 *                   example: 75.00
 *                 bid_date:
 *                   type: string
 *                   format: date
 *       400:
 *         description: Bid is not active or is not from today
 *       404:
 *         description: Bid not found or does not belong to you
 *       401:
 *         description: Auth required
 */
router.delete('/:id', verifyToken, bidController.cancelBid);

module.exports = router;
