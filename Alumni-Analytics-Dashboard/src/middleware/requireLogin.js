// Blocks any request from a non-logged-in dashboard user.
// Attach to all dashboard routes.
module.exports = function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Login required.' });
  }
  next();
};
