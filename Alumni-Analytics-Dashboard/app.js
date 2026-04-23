require('dotenv').config();
const express      = require('express');
const helmet       = require('helmet');
const session      = require('express-session');
const rateLimit    = require('express-rate-limit');
const path         = require('path');

const authRoutes      = require('./src/routes/auth');
const dashboardRoutes = require('./src/routes/dashboard');

const app  = express();
const PORT = process.env.PORT || 3001;

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      "img-src": ["'self'", "data:", "blob:"],
    },
  },
}));

// CORS Configuration
const cors = require('cors');
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session — used to track logged-in dashboard users
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 3600000,   // 1 hour
    sameSite: 'strict',
    secure: false,     // set true in production with HTTPS
  },
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Rate limit on auth routes only
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use('/api/auth',      authLimiter, authRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/health', (req, res) => res.json({ success: true }));

// 404
app.use((req, res) => res.status(404).json({ success: false, message: 'Not found.' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Server error.' });
});

app.listen(PORT, () => console.log(`Dashboard running on http://localhost:${PORT}`));
