// src/config/swagger.js
// OpenAPI 3.0 Swagger configuration
// Accessible at http://localhost:3000/api-docs — NO authentication required to view

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Phantasmagoria Alumni Platform API',
      version: '1.0.0',
      description: `
## API Reference

A secure REST API powering the **Phantasmagoria Alumni Engagement Platform** for the University of Eastminster.
This documentation covers every endpoint, its request/response structure, validation rules, and business logic.

## Authentication & Granular Permissions

This platform uses a **dual-mode authentication** strategy. Developer functionality is strictly governed by granular access control, meaning you must use the correct auth scheme below depending on the endpoint you wish to test.

| Client Platform | Method | Permissions / Scopes | Cannot Access |
|-----------------|--------|----------------------|---------------|
| **Alumni Portal** | JWT Bearer Token | *(Implied profile/bidding access)* | Developer API routes |
| **Analytics Dashboard** | API Key | \`read:alumni\`, \`read:analytics\` | AR app endpoints |
| **Mobile AR App** | API Key | \`read:alumni_of_day\` | Analytics endpoints |

> **Note:** Protected endpoints mathematically enforce required scopes using token payload cross-referencing and will immediately throw **403 Forbidden** if over-privileged access is attempted.

---

## Bidding Business Rules

| Rule | Detail |
|------|--------|
| **Win Limit** | Standard alumni may win a maximum of **3 times per calendar month** |
| **Event Bonus** | Alumni with \`has_event_participation = true\` may win **4 times** per month |
| **Blind Bids** | Bid amounts are **never revealed** to other users — only Win/Loss status is returned |
| **Ladder Rule** | Bids can **only increase**, never decrease |
| **Winner Selection** | Automated at **00:00 (12 AM Midnight) Sri Lanka Time** daily via Node-Cron |
      `,
      contact: {
        name: 'Phantasmagoria API',
      },
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Development Server' },
    ],
    security: [],
    components: {
      securitySchemes: {
        AlumniAppAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: '**Alumni JWT Token** — Obtained from \`POST /api/auth/login\`. Required for Profile and Bidding operations.',
        },
        AnalyticsDashboardAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'API-Key',
          description: '**Dashboard API Key** — Required scopes: \`[read:alumni, read:analytics]\`. Strictly isolated from AR data.',
        },
        MobileArAppAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'API-Key',
          description: '**Mobile AR App API Key** — Required scopes: \`[read:alumni_of_day]\`. Strictly isolated from Analytics telemetry.',
        },
      },
      schemas: {
        // ── Auth ──
        RegisterRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'alumni@westminster.ac.uk', description: 'Must be a university email (@ac.uk, @edu, @ac.lk)' },
            password: { type: 'string', minLength: 8, example: 'SecurePass@1', description: 'Min 8 chars, 1 uppercase, 1 number, 1 special character' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'alumni@westminster.ac.uk' },
            password: { type: 'string', example: 'SecurePass@1' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Login successful.' },
            token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: 'JWT — use as Authorization: Bearer <token>' },
            user: { $ref: '#/components/schemas/UserInfo' },
          },
        },
        UserInfo: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 3 },
            email: { type: 'string', example: 'alumni@westminster.ac.uk' },
            role: { type: 'string', enum: ['alumni', 'developer'], example: 'alumni' },
          },
        },
        // ── Profile ──
        ProfileUpdate: {
          type: 'object',
          properties: {
            first_name: { type: 'string', example: 'John' },
            last_name: { type: 'string', example: 'Smith' },
            biography: { type: 'string', example: 'Software engineer with 5 years experience.' },
            linkedin_url: { type: 'string', format: 'uri', example: 'https://linkedin.com/in/johnsmith' },
          },
        },
        FullProfileResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                first_name: { type: 'string', example: 'John' },
                last_name: { type: 'string', example: 'Smith' },
                biography: { type: 'string' },
                linkedin_url: { type: 'string' },
                profile_image: { type: 'string', example: '/uploads/profile-1-1712345678.jpg' },
                is_featured_today: { type: 'boolean', example: false },
                wins_this_month: { type: 'integer', example: 1 },
                remaining_wins: { type: 'integer', example: 2 },
                degrees: { type: 'array', items: { $ref: '#/components/schemas/DegreeItem' } },
                certifications: { type: 'array', items: { $ref: '#/components/schemas/CertItem' } },
                licences: { type: 'array', items: { $ref: '#/components/schemas/LicenceItem' } },
                courses: { type: 'array', items: { $ref: '#/components/schemas/CourseItem' } },
                employment: { type: 'array', items: { $ref: '#/components/schemas/JobItem' } },
              },
            },
          },
        },
        DegreeRequest: {
          type: 'object',
          required: ['title'],
          properties: {
            title: { type: 'string', example: 'BSc Computer Science' },
            institution: { type: 'string', example: 'University of Eastminster' },
            degree_url: { type: 'string', format: 'uri', example: 'https://www.eastminster.ac.uk/verify/123' },
            completion_date: { type: 'string', format: 'date', example: '2020-06-15' },
          },
        },
        DegreeItem: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            title: { type: 'string', example: 'BSc Computer Science' },
            institution: { type: 'string', example: 'University of Eastminster' },
            degree_url: { type: 'string' },
            completion_date: { type: 'string', format: 'date' },
          },
        },
        CertItem: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            title: { type: 'string', example: 'AWS Solutions Architect' },
            cert_url: { type: 'string' },
            completion_date: { type: 'string', format: 'date' },
          },
        },
        LicenceItem: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            title: { type: 'string', example: 'ACCA Chartered Accountant' },
            awarding_body: { type: 'string', example: 'ACCA UK' },
            licence_url: { type: 'string' },
          },
        },
        CourseItem: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            title: { type: 'string', example: 'Docker & Kubernetes Masterclass' },
            course_url: { type: 'string' },
            completion_date: { type: 'string', format: 'date' },
          },
        },
        JobItem: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            company: { type: 'string', example: 'Google DeepMind' },
            role: { type: 'string', example: 'Senior Software Engineer' },
            start_date: { type: 'string', format: 'date' },
            end_date: { type: 'string', format: 'date', nullable: true, description: 'null if current job' },
          },
        },
        // ── Bids ──
        BidRequest: {
          type: 'object',
          required: ['amount'],
          properties: {
            amount: { type: 'number', minimum: 0.01, example: 150.00, description: 'Must be greater than your current active bid' },
          },
        },
        BidStatusResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            has_bid: { type: 'boolean', example: true },
            status: { type: 'string', enum: ['winning', 'losing'], example: 'winning' },
            feedback: { type: 'string', example: 'You currently have the highest bid. Keep it up!' },
            your_bid_amount: { type: 'number', example: 150.00 },
            wins_this_month: { type: 'integer', example: 1 },
            wins_remaining: { type: 'integer', example: 2 },
          },
        },
        // ── Admin / Tokens ──
        TokenResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'API token generated. Copy it now — it will never be shown again.' },
            token_id: { type: 'integer', example: 4 },
            api_token: { type: 'string', example: 'a3f9c2...64hex', description: 'Raw token shown ONCE. Copy immediately.' },
            usage: { type: 'string', example: 'Add to requests as: Authorization: Bearer <token>' },
          },
        },
        // ── Public ──
        FeaturedAlumniResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            featured: {
              type: 'object',
              properties: {
                id: { type: 'integer', example: 5 },
                first_name: { type: 'string', example: 'Jane' },
                last_name: { type: 'string', example: 'Doe' },
                biography: { type: 'string' },
                linkedin_url: { type: 'string' },
                profile_image: { type: 'string' },
                email: { type: 'string', example: 'jane@westminster.ac.uk' },
                degrees: { type: 'array', items: { $ref: '#/components/schemas/DegreeItem' } },
                certifications: { type: 'array', items: { $ref: '#/components/schemas/CertItem' } },
                licences: { type: 'array', items: { $ref: '#/components/schemas/LicenceItem' } },
                courses: { type: 'array', items: { $ref: '#/components/schemas/CourseItem' } },
                employment: { type: 'array', items: { $ref: '#/components/schemas/JobItem' } },
                featured_date: { type: 'string', format: 'date', example: '2026-04-06' },
              },
            },
          },
        },
        // ── Shared ──
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Operation successful.' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'An error occurred.' },
          },
        },
        ValidationError: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string', example: 'email' },
                  msg: { type: 'string', example: 'Only university emails are allowed.' },
                },
              },
            },
          },
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Registration, email verification, login, and password reset' },
      { name: 'Profile', description: 'Alumni professional profile — personal info, qualifications, employment' },
      { name: 'Bids', description: 'Blind bidding system — place, increase, and check bid status. Requires JWT.' },
      { name: 'Admin', description: 'API token generation, revocation, and alumni win management. Requires Developer JWT.' },
      { name: 'Public Developer API', description: 'Public endpoints for the AR Client — secured with API Key (Bearer token from Admin panel)' },
    ],
  },
  apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
