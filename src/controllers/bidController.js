// src/controllers/bidController.js
// Blind Bidding System — core business logic
//   - Place bids WITHOUT revealing highest bid amount
//   - Update bids (increase only — never decrease)
//   - Monthly limit: max 3 wins per calendar month
//   - Automated midnight winner selection (handled by scheduler)
//   - Bid status feedback (winning/losing — no amounts revealed)

const { pool }  = require('../config/db');
const { validationResult } = require('express-validator');
const emailService = require('../services/emailService');

// -------------------------
// PLACE A BID
// POST /api/bids
// -------------------------
async function placeBid(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { amount } = req.body;
  const userId     = req.user.id;
  const userRole   = req.user.role;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(new Date()); // YYYY-MM-DD

  // -- Requirement 1: Developer cannot bid
  if (userRole === 'developer') {
    return res.status(403).json({ success: false, message: 'Developer accounts are prohibited from bidding. Please use an Alumni account.' });
  }

  // -- Midnight Cutoff logic:
  // Bidding is open all day for researchers and alumni.
  // The automated selection runs at exactly 12 AM (Midnight) for the day that just ended.

  try {
    // Calculate Tomorrow (Target Featured Date) explicitly
    const tomorrowObj = new Date();
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const targetFeaturedDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(tomorrowObj); // YYYY-MM-DD

    // Check if user already has a bid for tomorrow's highlight
    const [existing] = await pool.query(
      'SELECT id, amount FROM bids WHERE user_id = ? AND bid_date = ?',
      [userId, targetFeaturedDate]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'You already placed a bid today. Use PATCH /api/bids/:id to increase it.',
        bid_id: existing[0].id,
      });
    }

    // Check monthly win limit for the target month (max 3 wins per calendar month, or 4 if event participant)
    const targetYearMonth = targetFeaturedDate.substring(0, 7); // e.g., "2026-05" if bidding on April 30th
    const [monthWins] = await pool.query(
      'SELECT win_count FROM monthly_wins WHERE user_id = ? AND `year_month` = ?',
      [userId, targetYearMonth]
    );

    // Get event status from profile
    const [profile] = await pool.query(
      'SELECT has_event_participation FROM profiles WHERE user_id = ?',
      [userId]
    );

    const winCount = monthWins.length > 0 ? monthWins[0].win_count : 0;
    const hasEvent = profile.length > 0 ? !!profile[0].has_event_participation : false;
    const maxWins  = hasEvent ? 4 : 3; // Event participation grants 4th win opportunity

    if (winCount >= maxWins) {
      return res.status(403).json({
        success: false,
        message: `You have reached the maximum of ${maxWins} wins this month. You cannot bid further this month.`,
        total_monthly_wins: winCount,
        wins_remaining: 0,
      });
    }

    // Track previous champion
    const [oldBids] = await pool.query(
      `SELECT b.user_id, u.email, p.first_name 
       FROM bids b
       JOIN users u ON b.user_id = u.id
       JOIN profiles p ON p.user_id = b.user_id
       WHERE b.bid_date = ? AND b.STATUS = 'active'
       ORDER BY b.amount DESC, b.updated_at ASC LIMIT 1`,
      [targetFeaturedDate]
    );
    const oldChampion = oldBids[0];

    // Insert the bid for the TARGET date explicitly as 'active'
    const [result] = await pool.query(
      'INSERT INTO bids (user_id, amount, bid_date, STATUS) VALUES (?, ?, ?, ?)',
      [userId, amount, targetFeaturedDate, 'active']
    );

    // Track new champion
    const [newBids] = await pool.query(
      `SELECT b.user_id 
       FROM bids b
       WHERE b.bid_date = ? AND b.STATUS = 'active'
       ORDER BY b.amount DESC, b.updated_at ASC LIMIT 1`,
      [targetFeaturedDate]
    );
    const newChampion = newBids[0];

    // If there was a champion, and the new champion is the current user (different from old), send notification
    if (oldChampion && newChampion && newChampion.user_id === userId && oldChampion.user_id !== userId) {
      emailService.sendOutbidNotification(oldChampion.email, oldChampion.first_name).catch(e => console.error('Outbid Email Err:', e));
    }

    res.status(201).json({
      success:          true,
      message:          `Bid placed successfully for tomorrow's (${targetFeaturedDate}) alumni highlight.`,
      bid_id:           result.insertId,
      your_bid_amount:  amount,
      bid_date:         targetFeaturedDate,
      total_monthly_wins: winCount,
      wins_remaining:   maxWins - winCount,
    });

  } catch (err) {
    console.error('Place bid error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// -------------------------
// UPDATE BID (Increase Only)
// PATCH /api/bids/:id
// -------------------------
async function updateBid(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { amount } = req.body;
  const bidId  = req.params.id;
  const userId = req.user.id;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(new Date());

  // -- Midnight Cutoff check:
  // Bids can be increased anytime during the active day.

    const tomorrowObj = new Date();
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(tomorrowObj);

    try {
      // Find the bid — must belong to this user and be for the target date (tomorrow)
      const [rows] = await pool.query(
        'SELECT * FROM bids WHERE id = ? AND user_id = ? AND bid_date = ?',
        [bidId, userId, tomorrow]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Bid for ${tomorrow} not found, or it has already been settled.`,
        });
      }

    const currentBid = rows[0];

    // Enforce increase-only rule
    if (parseFloat(amount) <= parseFloat(currentBid.amount)) {
      return res.status(400).json({
        success: false,
        message: `New amount must be greater than your current bid of £${currentBid.amount}. Bids can only increase.`,
      });
    }

    // Check bid is still active (not already won/lost)
    if (currentBid.STATUS !== 'active') {
      console.log(`Bid Update Blocked: Bid ID ${bidId} STATUS is '${currentBid.STATUS}' (expected 'active')`);
      return res.status(400).json({
        success: false,
        message: `This bid is currently '${currentBid.STATUS}' and cannot be updated. Bids can only be updated while 'active' (before Midnight).`,
      });
    }

    // Track previous champion
    const [oldBids] = await pool.query(
      `SELECT b.user_id, u.email, p.first_name 
       FROM bids b
       JOIN users u ON b.user_id = u.id
       JOIN profiles p ON p.user_id = b.user_id
       WHERE b.bid_date = ? AND b.STATUS = 'active'
       ORDER BY b.amount DESC, b.updated_at ASC LIMIT 1`,
      [tomorrow]
    );
    const oldChampion = oldBids[0];

    await pool.query('UPDATE bids SET amount = ? WHERE id = ?', [amount, bidId]);

    // Track new champion
    const [newBids] = await pool.query(
      `SELECT b.user_id 
       FROM bids b
       WHERE b.bid_date = ? AND b.STATUS = 'active'
       ORDER BY b.amount DESC, b.updated_at ASC LIMIT 1`,
      [tomorrow]
    );
    const newChampion = newBids[0];

    // If there was a champion, and the new champion is the current user, send notification
    if (oldChampion && newChampion && newChampion.user_id === userId && oldChampion.user_id !== userId) {
      emailService.sendOutbidNotification(oldChampion.email, oldChampion.first_name).catch(e => console.error('Outbid Email Err:', e));
    }

    res.json({
      success:              true,
      message:              'Bid updated successfully for tomorrow\'s alumni highlight.',
      bid_id:               bidId,
      new_amount:           amount,
      previous_amount:      currentBid.amount,
    });

  } catch (err) {
    console.error('Update bid error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// -------------------------
// GET BID STATUS
// GET /api/bids/status
// -------------------------
async function getBidStatus(req, res) {
  const userId = req.user.id;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(new Date());

  try {
    // Get this user's bid for today
    // We now look for the bid directly by the today's date (which is used for tomorrow's slot)
    // Wait, if I bid ON the 10th for the 11th, it's stored as the 11th.
    // So today = 10, tomorrow = 11.
    const tomorrowObj = new Date();
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(tomorrowObj);
    const targetYearMonth = tomorrow.substring(0, 7);

    const [myBids] = await pool.query(
      'SELECT id, amount, STATUS, bid_date, created_at, updated_at FROM bids WHERE user_id = ? AND bid_date = ? AND STATUS = "active"',
      [userId, tomorrow]
    );

    if (myBids.length === 0) {
      return res.json({
        success: true,
        has_bid: false,
        message: "You haven't placed a bid today yet.",
      });
    }

    const myBid = myBids[0];
    const myAmount = parseFloat(myBid.amount);

    // Tie-break rule: If amounts are equal, the person who COMMITTED that amount first wins.
    // We use updated_at instead of created_at to prevent early minimum-bid exploits.
    const [others] = await pool.query(
      `SELECT COUNT(*) as count FROM bids 
       WHERE bid_date = ? AND STATUS = 'active' AND (amount > ? OR (amount = ? AND updated_at < ?))`,
      [tomorrow, myAmount, myAmount, myBid.updated_at]
    );

    const isWinning = others[0].count === 0;

    // Get win data for the target month
    const [monthWins] = await pool.query(
      'SELECT win_count FROM monthly_wins WHERE user_id = ? AND `year_month` = ?',
      [userId, targetYearMonth]
    );
    const winCount = monthWins.length > 0 ? monthWins[0].win_count : 0;

    // Get event status from profile for max wins check
    const [profileS] = await pool.query(
      'SELECT has_event_participation FROM profiles WHERE user_id = ?',
      [userId]
    );
    const hasEventS = profileS.length > 0 ? !!profileS[0].has_event_participation : false;
    const maxWinsS  = hasEventS ? 4 : 3;

    res.json({
      success:          true,
      has_bid:          true,
      bid_id:           myBid.id,
      your_bid_amount:  myBid.amount,     // Own amount — OK to share
      bid_date:         myBid.bid_date,
      STATUS:           isWinning ? 'winning' : 'losing',
      // Feedback follows the blind bidding protocol
      feedback:         isWinning
        ? 'You are currently the highest bidder for tomorrow\'s highlight. Keep going, daily winner selected at Midnight.'
        : 'You are not currently the highest bidder for tomorrow\'s highlight. Consider increasing your bid before Midnight.',
      total_monthly_wins: winCount,
      wins_remaining:     Math.max(0, maxWinsS - winCount),
      // NOTE: highest_amount is NEVER included in the response
    });

  } catch (err) {
    console.error('Get bid status error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─────────────────────────────────────────────
// GET MY BID HISTORY
// GET /api/bids/history
// ─────────────────────────────────────────────
async function getBidHistory(req, res) {
  const userId = req.user.id;
  const today2 = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(new Date());
  const yearMonth = today2.substring(0, 7);

  try {
    const [bids] = await pool.query(
      `SELECT id, amount, bid_date, STATUS, is_winner, created_at 
       FROM bids WHERE user_id = ? 
       ORDER BY bid_date DESC 
       LIMIT 30`,
      [userId]
    );

    const [monthWins] = await pool.query(
      'SELECT win_count FROM monthly_wins WHERE user_id = ? AND `year_month` = ?',
      [userId, yearMonth]
    );
    const winCount = monthWins.length > 0 ? monthWins[0].win_count : 0;

    // Get event status from profile for max wins check
    const [profileH] = await pool.query(
      'SELECT has_event_participation FROM profiles WHERE user_id = ?',
      [userId]
    );
    const hasEventH = profileH.length > 0 ? !!profileH[0].has_event_participation : false;
    const maxWinsH  = hasEventH ? 4 : 3;

    res.json({
      success:            true,
      bids,
      total_monthly_wins: winCount,
      wins_remaining:     Math.max(0, maxWinsH - winCount),
    });

  } catch (err) {
    console.error('Get bid history error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─────────────────────────────────────────────
// CANCEL BID
// DELETE /api/bids/:id
//
// Rules:
//   - A user may only cancel their own bid
//   - The bid must be for today and still 'active'
//   - Bids that have already been won/lost are final and cannot be cancelled
//   - Developers cannot bid and therefore have nothing to cancel
// ─────────────────────────────────────────────
async function cancelBid(req, res) {
  const bidId  = req.params.id;
  const userId = req.user.id;
  const today  = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(new Date());

    const tomorrowObj = new Date();
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(tomorrowObj);

    try {
      // Check if bid exists, belongs to user, and is for tomorrow (active bidding window)
      const [rows] = await pool.query(
        'SELECT * FROM bids WHERE id = ? AND user_id = ? AND bid_date = ? AND STATUS = "active"',
        [bidId, userId, tomorrow]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Active bid for tomorrow not found or already settled.',
        });
      }

    const bid = rows[0];

    // Normalize DB date to YYYY-MM-DD string for comparison
    const bidDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(new Date(bid.bid_date));

    // Prevent cancellation of bids that have already been resolved
    if (bid.STATUS !== 'active') {
      return res.status(400).json({
        success: false,
        message: `This bid has already been resolved as '${bid.STATUS}'. Only active bids placed today can be cancelled.`,
      });
    }

    // Prevent cancellation of bids that are not for tomorrow's highlight
    if (bidDateStr !== tomorrow) {
      return res.status(400).json({
        success: false,
        message: 'You can only cancel an active bid placed for tomorrow\'s highlight (before Midnight).',
        bid_date: bidDateStr,
        expected: tomorrow,
      });
    }

    // All checks passed — remove the bid
    await pool.query('DELETE FROM bids WHERE id = ?', [bidId]);

    return res.json({
      success: true,
      message: 'Your bid for tomorrow\'s highlight has been cancelled successfully. You may place a new bid before Midnight.',
      cancelled_bid_id:     parseInt(bidId, 10),
      cancelled_bid_amount: bid.amount,
      bid_date:             bid.bid_date,
    });

  } catch (err) {
    console.error('Cancel bid error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─────────────────────────────────────────────
// VIEW TOMORROW'S SLOT
// GET /api/bids/tomorrow
//
// Returns:
//   - Tomorrow's date (the next bidding window)
//   - Bidding window: 00:00 – 23:59 (Asia/Colombo)
//   - Winner selected at Midnight (end of that day)
//   - Whether the user is eligible to bid tomorrow
//     (checks monthly win limit for the relevant month)
//   - Current monthly win standing
// ─────────────────────────────────────────────
async function getTomorrowSlot(req, res) {
  const userId = req.user.id;

  // Compute tomorrow's date in the project timezone
  const tomorrowObj = new Date();
  tomorrowObj.setDate(tomorrowObj.getDate() + 1);
  const tomorrow    = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(tomorrowObj);
  const yearMonth   = tomorrow.substring(0, 7); // YYYY-MM (may differ at month boundary)

  try {
    // Gather the user's monthly win count for the relevant month
    const [monthWins] = await pool.query(
      'SELECT win_count FROM monthly_wins WHERE user_id = ? AND `year_month` = ?',
      [userId, yearMonth]
    );

    // Get event participation flag for the 4-win allowance
    const [profile] = await pool.query(
      'SELECT has_event_participation FROM profiles WHERE user_id = ?',
      [userId]
    );

    const winCount = monthWins.length > 0 ? monthWins[0].win_count : 0;
    const hasEvent = profile.length > 0 ? !!profile[0].has_event_participation : false;
    const maxWins  = hasEvent ? 4 : 3;
    const winsLeft = Math.max(0, maxWins - winCount);
    const eligible = winsLeft > 0;

    return res.json({
      success:    true,
      slot: {
        date:             tomorrow,
        bidding_opens:    `${tomorrow}T00:00:00+05:30`,
        bidding_closes:   `${tomorrow}T23:59:59+05:30`,
        winner_selected:  `${tomorrow}T00:00:00+05:30 (tonight — Midnight cutoff)`,
        timezone:         'Asia/Colombo',
        description:      'Bidding is for tomorrow\'s featured alumni slot. The highest eligible bidder at Midnight tonight wins the spot.',
      },
      eligibility: {
        can_bid:            eligible,
        reason:             eligible
          ? `You have ${winsLeft} win${winsLeft === 1 ? '' : 's'} remaining this month and may participate.`
          : 'You have reached the maximum number of wins for this month and are ineligible to bid tomorrow.',
        monthly_wins_used:  winCount,
        monthly_wins_max:   maxWins,
        wins_remaining:     winsLeft,
        event_bonus_active: hasEvent,
      },
    });

  } catch (err) {
    console.error('Get tomorrow slot error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = { placeBid, updateBid, getBidStatus, getBidHistory, cancelBid, getTomorrowSlot };
