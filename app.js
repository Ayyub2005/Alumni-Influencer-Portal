// app.js
// Main Express application entry point
// Production-grade Alumni Platform
// Phantasmagoria API Server

require('dotenv').config(); // Load .env first before anything else

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const path = require('path');
const swaggerUi = require('swagger-ui-express');

const { testConnection } = require('./src/config/db');
const authRoutes = require('./src/routes/auth');
const profileRoutes = require('./src/routes/profile');
const bidRoutes = require('./src/routes/bids');
const adminRoutes = require('./src/routes/admin');
const publicRoutes = require('./src/routes/public');
const { startScheduler, runMidnightSelection } = require('./src/services/bidScheduler');
const { verifyToken, verifyDeveloper } = require('./src/security/auth');

// ─────────────────────────────────────────────
// ROLE-BASED ACCESS CONTROL (REUSEABLE GUARDS)
// ─────────────────────────────────────────────
// Session-based guard for browser-facing pages (Swagger/Admin HTML)
const isAdminSession = (req, res, next) => {
  console.log(`[AUTH] Admin door check. Role detected: ${req.session.role || 'GUEST'}`);
  if (req.session.role !== 'developer') {
    return res.redirect('/index.html?error=unauthorized');
  }
  next();
};

const { setupCsrf, csrfProtection } = require('./src/security/csrf');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust Proxy for production Load Balancers (so rate limit tracks actual IPs)
app.set('trust proxy', 1);

// ─────────────────────────────────────────────
// 1. SECURITY LAYERS (Helmet.js, CORS, CSRF)
// ─────────────────────────────────────────────

// Helmet: Sets 14 security-related HTTP headers automatically
// Allowing inline scripts for local development/password reset page
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'"],
    },
  },
}));

// CORS: Restrict which origins can call this API
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
  credentials: true,           // Allow cookies to be sent cross-origin
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
}));

// Rate limiter for auth routes (prevents brute force attacks)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minute window
  max: 20,               // Max 20 requests per IP per window
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests.' },
});

// ─────────────────────────────────────────────
// 2. DATA PROCESSING (Body Parsing)
// ─────────────────────────────────────────────
app.use(express.json());                            // Parse JSON request bodies
app.use(express.urlencoded({ extended: true }));    // Parse form data

// ─────────────────────────────────────────────
// 3. SESSION MANAGEMENT
// ─────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,                                  // JS cannot access session cookie
    maxAge: 3600000,                               // 1 hour session timeout
    sameSite: 'strict',                              // CSRF protection
  },
}));

// Apply CSRF setup
app.use(setupCsrf);

// CSRF Protected API scope
// We apply protection to all /api routes EXCEPT the token fetch itself
app.use('/api', (req, res, next) => {
  if (req.path === '/csrf-token') return next();
  csrfProtection(req, res, next);
});

// CSRF Token Fetch Route
app.get('/api/csrf-token', (req, res) => {
  res.json({ success: true, csrfToken: req.session.csrfToken });
});

// ─────────────────────────────────────────────
// 4. PROTECTED ADMIN PAGES
// MUST BE BEFORE STATIC MIDDLEWARE TO TAKE PRECEDENCE
// ─────────────────────────────────────────────
app.get('/admin.html', isAdminSession, (req, res) => {
  res.sendFile(path.join(__dirname, 'protected', 'admin.html'));
});

// ─────────────────────────────────────────────
// 5. STATIC FILES (Frontend UI & uploaded profile images)
// ─────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─────────────────────────────────────────────
// 6. API DOCUMENTATION (Swagger/OpenAPI UI)
// Accessible at /api-docs (Open)
// ─────────────────────────────────────────────
const swaggerSpec = require('./src/config/swagger');
app.use('/api-docs', isAdminSession, swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  swaggerOptions: {
    defaultModelsExpandDepth: -1,
  },
  customCss: `
    /* --- Base & Typography --- */
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Fira+Code:wght@400;500&display=swap');
    body { background: #1e1e24 !important; margin: 0; }
    .swagger-ui { font-family: 'Outfit', sans-serif !important; background: #1e1e24 !important; color: #e2e8f0 !important; }
    .swagger-ui .wrapper { max-width: 1240px !important; padding: 0 2rem !important; margin: 0 auto !important; }

    /* --- Typography & Header --- */
    .swagger-ui .info { margin: 2rem 0 1.5rem !important; }
    .swagger-ui .info h2.title { font-size: 2.25rem !important; font-weight: 700 !important; color: #f8fafc !important; }
    .swagger-ui .info .description p, .swagger-ui .info .description li, .swagger-ui .info .description td { color: #cbd5e1 !important; font-size: 0.95rem !important; line-height: 1.6 !important; margin-bottom: 0.5rem !important; }
    .swagger-ui .info .description h2 { color: #f8fafc !important; font-size: 1.25rem !important; margin-top: 1.5rem !important; border-bottom: 1px solid rgba(255,255,255,0.08) !important; padding-bottom: 0.5rem !important; }
    .swagger-ui .info .description code { background: rgba(255,255,255,0.05) !important; color: #a8b2d1 !important; border: 1px solid rgba(255,255,255,0.1) !important; padding: 2px 6px !important; border-radius: 4px !important; font-family: 'Fira Code', monospace !important; font-size: 0.8rem !important; }
    .swagger-ui .info a { color: #60a5fa !important; text-decoration: none !important; font-weight: 500 !important; transition: opacity 0.2s !important; }
    .swagger-ui .info a:hover { opacity: 0.8 !important; }

    /* --- Hide unwanted elements --- */
    .swagger-ui .topbar, .swagger-ui .info .oas, .swagger-ui .models, .swagger-ui .info .title small { display: none !important; }

    /* --- Buttons & Authorization --- */
    .swagger-ui .btn { font-family: 'Outfit', sans-serif !important; font-weight: 500 !important; border-radius: 6px !important; transition: background 0.2s !important; text-transform: none !important; box-shadow: none !important; padding: 6px 14px !important; margin-right: 10px !important; background: transparent !important; border: 1px solid rgba(255,255,255,0.3) !important; color: #e2e8f0 !important; }
    .swagger-ui .btn:hover { background: rgba(255,255,255,0.1) !important; }
    .swagger-ui .btn.authorize { background: #10b981 !important; color: #fff !important; border: none !important; padding: 8px 16px !important; display: inline-flex !important; align-items: center !important; gap: 6px !important; font-size: 0.9rem !important; }
    .swagger-ui .btn.authorize:hover { background: #059669 !important; }
    .swagger-ui .btn.authorize svg { fill: #fff !important; }
    .swagger-ui .btn.execute { background: #3b82f6 !important; color: #fff !important; border: none !important; padding: 8px 24px !important; margin-top: 1rem !important; font-weight: 600 !important; }
    .swagger-ui .btn.execute:hover { background: #2563eb !important; }
    .swagger-ui .btn.cancel { background: transparent !important; border: 1px solid rgba(239,68,68,0.5) !important; color: #f87171 !important; margin-left: 10px !important; }
    .swagger-ui .btn.cancel:hover { background: rgba(239,68,68,0.1) !important; }
    .swagger-ui .btn-clear { background: transparent !important; border: 1px solid rgba(239,68,68,0.5) !important; color: #f87171 !important; margin-top: 1rem !important; margin-left: 10px !important; }
    .swagger-ui .btn-clear:hover { background: rgba(239,68,68,0.1) !important; }
    
    /* --- Forms, Inputs & Textareas --- */
    .swagger-ui input[type="text"], .swagger-ui input[type="password"], .swagger-ui textarea, .swagger-ui select { background: #2a2b36 !important; border: 1px solid rgba(255,255,255,0.1) !important; color: #f8fafc !important; border-radius: 6px !important; padding: 8px 12px !important; font-family: 'Fira Code', monospace !important; font-size: 0.85rem !important; transition: all 0.2s ease !important; width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; }
    .swagger-ui input[type="text"]:focus, .swagger-ui input[type="password"]:focus, .swagger-ui textarea:focus { border-color: #60a5fa !important; outline: none !important; box-shadow: none !important; }
    
    /* --- Parameters Table --- */
    .swagger-ui .parameters-col_name { color: #f1f5f9 !important; font-weight: 500 !important; font-size: 0.95rem !important; padding-bottom: 0.25rem !important; }
    .swagger-ui .parameter__type { color: #9ca3af !important; font-family: 'Fira Code', monospace !important; font-size: 0.75rem !important; background: rgba(255,255,255,0.05) !important; padding: 2px 6px !important; border-radius: 4px !important; margin-top: 0.25rem !important; display: inline-block !important; }
    .swagger-ui .parameters-col_description p { color: #cbd5e1 !important; font-size: 0.85rem !important; line-height: 1.5 !important; }
    .swagger-ui table thead tr td, .swagger-ui table thead tr th { color: #94a3b8 !important; font-size: 0.75rem !important; font-weight: 600 !important; text-transform: uppercase !important; letter-spacing: 0.05em !important; border-bottom: 1px solid rgba(255,255,255,0.1) !important; padding-bottom: 0.75rem !important; }
    .swagger-ui table.parameters tbody tr td { padding: 0.75rem 0 !important; border-bottom: 1px solid rgba(255,255,255,0.05) !important; }

    /* --- Tag Headers --- */
    .swagger-ui .opblock-tag { font-size: 1.25rem !important; font-weight: 600 !important; color: #f8fafc !important; border-bottom: 1px solid rgba(255,255,255,0.1) !important; padding: 1rem 0 0.5rem !important; margin: 1.5rem 0 1rem !important; display: flex !important; align-items: center !important; }
    .swagger-ui .opblock-tag:hover { background: transparent !important; }
    .swagger-ui .opblock-tag small { color: #94a3b8 !important; font-size: 0.85rem !important; font-weight: 400 !important; margin-left: 1rem !important; }
    .swagger-ui .opblock-tag button { margin-left: auto !important; }

    /* --- Operation Blocks --- */
    .swagger-ui .opblock { border-radius: 6px !important; background: #262730 !important; border: 1px solid rgba(255,255,255,0.08) !important; margin-bottom: 0.75rem !important; box-shadow: none !important; transition: border-color 0.2s !important; overflow: hidden !important; }
    .swagger-ui .opblock:hover { border-color: rgba(255,255,255,0.2) !important; }
    .swagger-ui .opblock .opblock-summary { border: none !important; padding: 0.75rem 1rem !important; display: flex !important; align-items: center !important; }
    .swagger-ui .opblock .opblock-summary:hover { background: rgba(255,255,255,0.02) !important; }
    .swagger-ui .opblock .opblock-summary-method { border-radius: 4px !important; min-width: 80px !important; text-align: center !important; font-size: 0.75rem !important; font-weight: 700 !important; padding: 6px 12px !important; color: #fff !important; box-shadow: none !important; text-shadow: none !important; }
    .swagger-ui .opblock .opblock-summary-path { font-size: 0.95rem !important; font-weight: 500 !important; color: #f1f5f9 !important; font-family: 'Fira Code', monospace !important; padding-left: 1rem !important; }
    .swagger-ui .opblock .opblock-summary-path__deprecated { text-decoration: line-through !important; opacity: 0.4 !important; }
    .swagger-ui .opblock .opblock-summary-description { color: #a1a1aa !important; font-size: 0.85rem !important; text-align: right !important; padding-right: 1rem !important; font-weight: 400 !important; }
    
    .swagger-ui .authorization__btn { padding-left: 15px !important; }
    .swagger-ui .authorization__btn svg { fill: #94a3b8 !important; }
    .swagger-ui .authorization__btn.locked svg { fill: #10b981 !important; }
    .swagger-ui .authorization__btn.unlocked svg { fill: #ef4444 !important; }

    /* --- Operation Details --- */
    .swagger-ui .opblock .opblock-body { background: #22232c !important; border-top: 1px solid rgba(255,255,255,0.05) !important; padding: 1.25rem 1rem !important; }
    .swagger-ui .opblock-description-wrapper p { color: #cbd5e1 !important; font-size: 0.95rem !important; line-height: 1.6 !important; margin-bottom: 1.5rem !important; }
    .swagger-ui .opblock-section-header { background: transparent !important; border: none !important; box-shadow: none !important; padding: 0 0 0.75rem !important; border-bottom: 1px solid rgba(255,255,255,0.08) !important; margin-bottom: 1rem !important; }
    .swagger-ui .opblock-section-header h4 { color: #f8fafc !important; font-size: 0.95rem !important; font-weight: 600 !important; }
    
    /* --- Responses Table --- */
    .swagger-ui table.responses-table { border: 1px solid rgba(255,255,255,0.08) !important; border-radius: 6px !important; overflow: hidden !important; background: #262730 !important; }
    .swagger-ui table.responses-table thead tr { background: #2d2e38 !important; }
    .swagger-ui .responses-table .response-col_status { color: #10b981 !important; font-size: 1rem !important; font-weight: 600 !important; padding: 1rem !important; }
    .swagger-ui .response-col_description { padding: 1rem !important; }
    .swagger-ui .response-col_description p { color: #cbd5e1 !important; font-size: 0.85rem !important; }

    /* --- Code Blocks --- */
    .swagger-ui .highlight-code pre, .swagger-ui .microlight { background: #1a1b22 !important; border: 1px solid rgba(255,255,255,0.08) !important; border-radius: 6px !important; padding: 1rem !important; font-family: 'Fira Code', monospace !important; font-size: 0.8rem !important; line-height: 1.5 !important; color: #a1a1aa !important; box-shadow: none !important; }
    .swagger-ui .copy-to-clipboard { background: rgba(255,255,255,0.05) !important; border-radius: 0 6px 0 6px !important; }
    .swagger-ui .copy-to-clipboard button { width: 32px !important; height: 32px !important; display: flex !important; justify-content: center !important; align-items: center !important; }
    .swagger-ui .copy-to-clipboard button:hover { background: rgba(255,255,255,0.1) !important; }

    /* --- Method Colors (Solid, Flat) --- */
    .swagger-ui .opblock.opblock-get { border-color: rgba(14,165,233,0.3) !important; background: rgba(14,165,233,0.05) !important; }
    .swagger-ui .opblock.opblock-post { border-color: rgba(16,185,129,0.3) !important; background: rgba(16,185,129,0.05) !important; }
    .swagger-ui .opblock.opblock-put { border-color: rgba(245,158,11,0.3) !important; background: rgba(245,158,11,0.05) !important; }
    .swagger-ui .opblock.opblock-patch { border-color: rgba(249,115,22,0.3) !important; background: rgba(249,115,22,0.05) !important; }
    .swagger-ui .opblock.opblock-delete { border-color: rgba(239,68,68,0.3) !important; background: rgba(239,68,68,0.05) !important; }
        
    .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #0ea5e9 !important; }
    .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #10b981 !important; }
    .swagger-ui .opblock.opblock-put .opblock-summary-method { background: #f59e0b !important; color: #1c1917 !important; }
    .swagger-ui .opblock.opblock-patch .opblock-summary-method { background: #f97316 !important; }
    .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #ef4444 !important; }

    /* --- Scrollbars --- */
    .swagger-ui ::-webkit-scrollbar { width: 8px; height: 8px; }
    .swagger-ui ::-webkit-scrollbar-track { background: transparent; }
    .swagger-ui ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
    .swagger-ui ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }
  `,
  customSiteTitle: "Phantasmagoria API Documentation",
  swaggerOptions: {
    defaultModelsExpandDepth: 1,
    defaultModelExpandDepth: 2,
    docExpansion: 'list',
    filter: true,
    displayRequestDuration: false,
    tryItOutEnabled: false,
  },
}));

// ─────────────────────────────────────────────
// 6. ROUTES
// ─────────────────────────────────────────────

// Apply auth-specific rate limit to auth routes (more restrictive)
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api/admin', verifyToken, verifyDeveloper, adminRoutes);
app.use('/api/public', publicRoutes);
const analyticsRoutes = require('./src/routes/analytics');
app.use('/api/analytics', analyticsRoutes);

// Apply general rate limit to all other routes
app.use(generalLimiter);

// Health check endpoint (good practice, helps with deployment)
app.get('/health', (req, res) => {
  res.json({ success: true, message: 'Phantasmagoria API is running.', timestamp: new Date() });
});

// ─────────────────────────────────────────────
// 7. GLOBAL ERROR HANDLER 
// Catches any errors passed via next(err)
// ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({ success: false, message: 'Something went wrong on the server.' });
});

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found.` });
});

// ─────────────────────────────────────────────
// 8. START SERVER
// ─────────────────────────────────────────────
async function startServer() {
  await testConnection(); // Test DB connection before starting
  
  // Run a sweep immediately on startup to catch any missed midnight sweeps while the server was offline
  await runMidnightSelection();
  
  startScheduler();       // Start midnight bid scheduler
  app.listen(PORT, () => {
    console.log(`Phantasmagoria API running on http://localhost:${PORT}`);
    console.log(`Swagger docs at http://localhost:${PORT}/api-docs`);
  });
}

startServer();
