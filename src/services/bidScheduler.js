// src/services/bidScheduler.js
// Automated daily winner selection at 12 AM (Midnight)
// Uses node-cron for scheduled tasks

const cron = require('node-cron');
const { pool } = require('../config/db');
const emailService = require('./emailService');

// ─────────────────────────────────────────────
// DAILY WINNER SELECTION (12 AM - Midnight)
// Logic:
//   1. Sweep for any 'active' bids from past dates (handles server downtime)
//   2. For each date:
//      - Reset characters of the day
//      - Find highest eligible bidder (Respecting 3/4 win limit)
//      - Mark statuses (won/lost)
//      - Notify users
// ─────────────────────────────────────────────
async function runMidnightSelection() {
  console.log('\n MIDNIGHT JOB: Running winner selection sweep...');

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(new Date());
  const connection = await pool.getConnection();

  try {
    // 1. Reset all profiles is_featured_today at the start of the sweep
    // This ensures that if no one bid for today, the highlight is cleared 
    // instead of showing a stale winner from days ago.
    await connection.query('UPDATE profiles SET is_featured_today = FALSE');

    // 2. Identify all dates that have 'active' bids up to today
    // Using <= ensures that bids placed yesterday for "today" are processed 
    // at Midnight (the start of today).
    const [pastDates] = await connection.query(
      "SELECT DISTINCT bid_date FROM bids WHERE bid_date <= ? AND STATUS = 'active' ORDER BY bid_date ASC",
      [today]
    );

    if (pastDates.length === 0) {
      console.log('  No stranded past bids found. Highlight reset complete.');
      return;
    }

    console.log(`  Found stranded bids for ${pastDates.length} days. Processing...`);

    for (const row of pastDates) {
      const targetDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(new Date(row.bid_date));
      const yearMonth = targetDate.substring(0, 7);

      console.log(`\n  [${targetDate}] Processing bids...`);

      try {
        await connection.beginTransaction();

        // The reset is now handled at the start of the sweep
        // to manage stale highlights correctly.

        // 2. Get active bids for this specific target date
        const [bids] = await connection.query(
          `SELECT b.id, b.user_id, b.amount, u.email, p.first_name, p.id as profile_id, p.has_event_participation
           FROM bids b
           JOIN users u ON b.user_id = u.id
           JOIN profiles p ON p.user_id = b.user_id
           WHERE b.bid_date = ? AND b.STATUS = 'active'
           ORDER BY b.amount DESC, b.updated_at ASC`,
          [targetDate]
        );

        if (bids.length === 0) {
          console.log(`    No active bids found for ${targetDate}. marking any status errors.`);
          await connection.commit();
          continue;
        }

        let actualWinner = null;
        let winnerIndex = -1;

        // 3. Find highest eligible bidder
        for (let i = 0; i < bids.length; i++) {
          const bid = bids[i];
          const [mWins] = await connection.query(
            'SELECT win_count FROM monthly_wins WHERE user_id = ? AND `year_month` = ?',
            [bid.user_id, yearMonth]
          );

          const wins = mWins.length > 0 ? mWins[0].win_count : 0;
          const maxWins = bid.has_event_participation ? 4 : 3;

          if (wins < maxWins) {
            actualWinner = bid;
            winnerIndex = i;
            break;
          }
        }

        if (!actualWinner) {
          console.log(`    All ${bids.length} bidders hit monthly limits. No winner.`);
          await connection.query("UPDATE bids SET STATUS = 'lost' WHERE bid_date = ?", [targetDate]);
          await connection.commit();
          continue;
        }

        // 4. Update Statuses
        await connection.query("UPDATE bids SET STATUS = 'won', is_winner = TRUE WHERE id = ?", [actualWinner.id]);
        await connection.query("UPDATE bids SET STATUS = 'lost', is_winner = FALSE WHERE bid_date = ? AND id != ?", [targetDate, actualWinner.id]);

        // 5. Update monthly wins (Robust count from table to prevent desync)
        await connection.query(
          `INSERT INTO monthly_wins (user_id, \`year_month\`, win_count) 
           VALUES (?, ?, (SELECT COUNT(*) FROM bids WHERE user_id = ? AND is_winner = 1 AND bid_date LIKE ?))
           ON DUPLICATE KEY UPDATE win_count = (SELECT COUNT(*) FROM bids WHERE user_id = ? AND is_winner = 1 AND bid_date LIKE ?)`,
          [actualWinner.user_id, yearMonth, actualWinner.user_id, `${yearMonth}%`, actualWinner.user_id, `${yearMonth}%`]
        );

        // 6. Set Featured Profile
        await connection.query(
          'UPDATE profiles SET is_featured_today = TRUE, appearance_count = appearance_count + 1 WHERE id = ?',
          [actualWinner.profile_id]
        );

        await connection.commit();
        console.log(`    Winner Selected: ${actualWinner.email}`);

        // 7. Notifications (Non-blocking)
        emailService.sendWinnerNotification(actualWinner.email, actualWinner.first_name || 'Alumni', actualWinner.amount).catch(e => console.error('Email Fail:', e));

        const losers = bids.filter((_, idx) => idx !== winnerIndex);
        losers.forEach(loser => {
          emailService.sendLoserNotification(loser.email, loser.first_name || 'Alumni').catch(e => console.error('Email Fail:', e));
        });

      } catch (innerErr) {
        await connection.rollback();
        console.error(`    Error processing date ${targetDate}:`, innerErr);
      }
    }

  } catch (err) {
    console.error('Scheduler sweep error:', err);
  } finally {
    connection.release();
  }
}

function startScheduler() {
  cron.schedule('0 0 * * *', runMidnightSelection, { timezone: 'Asia/Colombo' });
  cron.schedule('0 0 1 * *', runMonthlyReset, { timezone: 'Asia/Colombo' });

  console.log('⏰ Bid scheduler started — daily midnight sweep active.');
}

async function runMonthlyReset() {
  // LOGIC FIX: In an earlier iteration, this forcefully zeroed out the previous month's wins.
  // However, the `monthly_wins` table records data segregated by `year_month`. 
  // Forcefully zeroing out the previous month destroys historical analytics (e.g., how many times someone won in April).
  // The system naturally "resets" limit caps because a new month generates a new `year_month` string.
  console.log(`MONTHLY RESET: Skiped database reset. Using rolling year_month partition natively.`);
}

module.exports = { startScheduler, runMidnightSelection, runMonthlyReset };
