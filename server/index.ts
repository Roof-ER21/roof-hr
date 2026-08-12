import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import path from 'path';
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import session from "express-session";
import passport from "passport";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

import { storage } from "./storage";
import { testConnection, db } from "./db";
import { applyPendingMigrations } from "./migrationRunner";
import { sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { config, validateConfig } from './config';
import { rateLimit, sanitizeInput, configureCORS, securityLogger, clearRateLimit } from './middleware/security';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { captureToGlitchTip } from './utils/glitchtip';
import { requestLogger, logger } from './middleware/logger';
import { auditTrail } from './middleware/audit';
import { contractPdfService } from './services/contractPdfService';

async function createAdminUser() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@roof-hr.com';
    
    // Check if admin exists
    const existingAdmin = await storage.getUserByEmail(adminEmail);
    
    if (!existingAdmin) {
      const tempPassword = process.env.ADMIN_TEMP_PASSWORD || `TempAdmin${Date.now()}!`;
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      
      await storage.createUser({
        email: adminEmail,
        passwordHash: hashedPassword,
        firstName: process.env.ADMIN_FIRST_NAME || 'System',
        lastName: process.env.ADMIN_LAST_NAME || 'Administrator',
        role: 'ADMIN',
        employmentType: 'W2',
        department: 'Administration',
        position: 'System Administrator',
        hireDate: new Date().toISOString().split('T')[0],
        isActive: true,
        mustChangePassword: true
      });
      
      logger.info(`Created admin user: ${adminEmail} - IMPORTANT: Change the temporary password immediately!`);
      if (!process.env.ADMIN_TEMP_PASSWORD) {
        logger.warn(`Temporary password generated: ${tempPassword}`);
      }
    }
  } catch (error) {
    logger.error('Failed to create admin user:', error);
  }
}

// Run database migrations at startup
async function runMigrations() {
  try {
    logger.info('[Migration] Running database migrations...');

    // Add timezone column to users table if it doesn't exist
    await db.execute(sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/New_York'
    `);
    logger.info('[Migration] ✅ Timezone column ready');

    // Create index for timezone lookups (if not exists)
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_users_timezone ON users(timezone)
    `);
    logger.info('[Migration] ✅ Timezone index ready');

    // Add screener_color column for sourcer identification
    await db.execute(sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS screener_color TEXT
    `);
    logger.info('[Migration] ✅ Screener color column ready');

    // Add status_changed_at to candidates for kanban "most recently moved" ordering.
    // Nullable, no default — existing rows stay NULL and fall back to created_at
    // in the client sort. Instant DDL, no table rewrite.
    await db.execute(sql`
      ALTER TABLE candidates
      ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP
    `);
    logger.info('[Migration] ✅ candidates.status_changed_at column ready');

    // Ensure employee contracts table and columns exist (new public link flow)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS employee_contracts (
        id TEXT PRIMARY KEY,
        employee_id TEXT,
        candidate_id TEXT,
        recipient_type TEXT NOT NULL DEFAULT 'EMPLOYEE',
        recipient_email TEXT NOT NULL DEFAULT '',
        recipient_name TEXT NOT NULL DEFAULT '',
        template_id TEXT,
        title TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        file_url TEXT,
        file_name TEXT,
        access_token TEXT,
        token_expiry TIMESTAMP,
        status TEXT NOT NULL DEFAULT 'DRAFT',
        sent_date TIMESTAMP,
        viewed_date TIMESTAMP,
        signed_date TIMESTAMP,
        signature TEXT,
        signature_address TEXT,
        signature_ip TEXT,
        rejection_reason TEXT,
        notified_managers TEXT[],
        field_values JSONB,
        sent_by TEXT,
        reminder_stages TEXT[],
        created_by TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    logger.info('[Migration] ✅ employee_contracts table ensured');

    // Backfill missing employee_contracts columns for existing deployments
    await db.execute(sql`ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS employee_id TEXT`);
    await db.execute(sql`ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS candidate_id TEXT`);
    await db.execute(sql`ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS recipient_type TEXT NOT NULL DEFAULT 'EMPLOYEE'`);
    await db.execute(sql`ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS recipient_email TEXT NOT NULL DEFAULT ''`);
    await db.execute(sql`ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS recipient_name TEXT NOT NULL DEFAULT ''`);
    await db.execute(sql`ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS template_id TEXT`);
    await db.execute(sql`ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT ''`);
    await db.execute(sql`ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS content TEXT NOT NULL DEFAULT ''`);
    await db.execute(sql`ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS file_url TEXT`);
    await db.execute(sql`ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS file_name TEXT`);
    await db.execute(sql`ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS access_token TEXT`);
    await db.execute(sql`ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS token_expiry TIMESTAMP`);
    await db.execute(sql`ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'DRAFT'`);
    await db.execute(sql`ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS sent_date TIMESTAMP`);
    await db.execute(sql`ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS viewed_date TIMESTAMP`);
    await db.execute(sql`ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS signed_date TIMESTAMP`);
    await db.execute(sql`ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS signature TEXT`);
    await db.execute(sql`ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS signature_address TEXT`);
    await db.execute(sql`ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS signature_ip TEXT`);
    await db.execute(sql`ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS rejection_reason TEXT`);
    await db.execute(sql`ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS notified_managers TEXT[] DEFAULT '{}'::text[]`);
    await db.execute(sql`ALTER TABLE employee_contracts ALTER COLUMN notified_managers SET DEFAULT '{}'::text[]`);
    await db.execute(sql`ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS field_values JSONB DEFAULT '{}'::jsonb`);
    await db.execute(sql`ALTER TABLE employee_contracts ALTER COLUMN field_values SET DEFAULT '{}'::jsonb`);
    await db.execute(sql`ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS sent_by TEXT`);
    await db.execute(sql`ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS reminder_stages TEXT[] DEFAULT '{}'::text[]`);
    await db.execute(sql`ALTER TABLE employee_contracts ALTER COLUMN reminder_stages SET DEFAULT '{}'::text[]`);
    await db.execute(sql`ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT ''`);
    await db.execute(sql`ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW()`);
    await db.execute(sql`ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()`);
    logger.info('[Migration] ✅ employee_contracts columns aligned');

    // One-time migration: Deactivate admin@theroofdocs.com (Jan 2026).
    // The original statement referenced "isActive"/"updatedAt"/status — none
    // exist on this schema (columns are snake_case, users has no status
    // column), so it 42703-failed every boot and skipped the DDL below it.
    const deactivateResult = await db.execute(sql`
      UPDATE users
      SET is_active = false,
          updated_at = NOW()
      WHERE email = 'admin@theroofdocs.com'
        AND is_active = true
    `);
    if (deactivateResult.rowCount && deactivateResult.rowCount > 0) {
      logger.info('[Migration] ✅ Deactivated admin@theroofdocs.com');
    }

    // Ensure user_email_preferences table exists
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_email_preferences (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        pto_notifications BOOLEAN NOT NULL DEFAULT true,
        contract_notifications BOOLEAN NOT NULL DEFAULT true,
        review_notifications BOOLEAN NOT NULL DEFAULT true,
        task_notifications BOOLEAN NOT NULL DEFAULT true,
        system_announcements BOOLEAN NOT NULL DEFAULT true,
        weekly_digest BOOLEAN NOT NULL DEFAULT false,
        mention_notifications BOOLEAN NOT NULL DEFAULT true,
        interview_notifications BOOLEAN NOT NULL DEFAULT true,
        calendar_notifications BOOLEAN NOT NULL DEFAULT true,
        onboarding_notifications BOOLEAN NOT NULL DEFAULT true,
        equipment_notifications BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_email_prefs_user_id ON user_email_preferences(user_id)
    `);
    logger.info('[Migration] ✅ user_email_preferences table ready');

    logger.info('[Migration] All migrations completed successfully');
  } catch (error: any) {
    // If the column already exists, that's fine
    if (error?.code === '42701') { // duplicate_column
      logger.info('[Migration] Column already exists, skipping');
    } else {
      logger.error('[Migration] Migration failed:', error);
      // Don't exit - let the server start anyway, migrations might not be critical
    }
  }
}

const app = express();

// Trust proxy headers (needed for Replit and other proxied environments)
app.set('trust proxy', true);

// Serve contract template PDFs
const contractTemplatesDir = contractPdfService.getTemplatesDir();
app.use('/contract-templates', express.static(contractTemplatesDir));
// Backward-compat: serve from attached_assets path used by stored URLs
app.use('/attached_assets/contract_templates', express.static(contractTemplatesDir));

// Session configuration with security improvements
app.use(session({
  secret: config.session.secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.session.secure, // HTTPS only in production
    httpOnly: true, // Prevent XSS
    maxAge: config.session.maxAge,
    sameSite: config.session.sameSite
  }
}));

// Request logging
app.use(requestLogger);

// CORS configuration
app.use(configureCORS);

// Security middleware - Rate limiting for API routes
// Increased limit to handle polling requests (notifications, auth validation)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs (was 100 - too restrictive)
  skipSuccessfulRequests: false
});
app.use('/api/', limiter);

// Public endpoint to clear rate limits (for emergency lockout recovery)
app.get('/api/public/reset-rate-limits', (req, res) => {
  clearRateLimit();
  console.log('[Rate Limit] Emergency rate limit reset triggered');
  res.json({ success: true, message: 'Rate limits cleared for all IPs' });
});

// Body parsing with input sanitization
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(sanitizeInput);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Blanket audit trail for authenticated mutating /api requests (system_audit_logs)
app.use(auditTrail);

(async () => {
  // Global error handlers
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    captureToGlitchTip({ endpoint: 'process.uncaughtException', message: String(error?.message || error), stack: error?.stack, level: 'fatal' });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
    captureToGlitchTip({ endpoint: 'process.unhandledRejection', message: String((reason as Error)?.message || reason), stack: (reason as Error)?.stack, level: 'fatal' });
    process.exit(1);
  });

  // Validate configuration
  try {
    validateConfig();
    logger.info('Configuration validated successfully');
  } catch (error) {
    logger.error('Configuration error:', error);
    process.exit(1);
  }

  await registerRoutes(app);

  // Test database connection before starting server
  logger.info('Testing database connection...');
  const dbConnected = await testConnection(5); // 5 retries
  if (!dbConnected) {
    logger.error('Failed to connect to database after multiple attempts. Exiting...');
    process.exit(1);
  }
  logger.info('Database connection established successfully');

  // Run database migrations: legacy inline DDL first, then the tracked
  // file-based chain in migrations/ (see server/migrationRunner.ts)
  await runMigrations();

  // Warm the authorization-grant cache (falls back to legacy constants until loaded)
  const { initAuthz } = await import('./services/authzService');
  initAuthz();
  await applyPendingMigrations();

  // Create admin user if not exists
  await createAdminUser();

  // Create server instance
  const server = createServer(app);
  
  // Create Socket.io instance
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || "*",
      methods: ["GET", "POST"],
      credentials: true
    },
    path: '/socket.io/',
    transports: ['websocket', 'polling']
  });
  
  // Make io accessible in routes
  app.locals.io = io;
  
  // Socket.io connection handling
  io.on('connection', (socket) => {
    logger.info(`New WebSocket connection: ${socket.id}`);

    // Join attendance session rooms
    socket.on('join-session', (sessionId) => {
      socket.join(`attendance:${sessionId}`);
      logger.info(`Socket ${socket.id} joined attendance session: ${sessionId}`);
    });

    // Leave attendance session rooms
    socket.on('leave-session', (sessionId) => {
      socket.leave(`attendance:${sessionId}`);
      logger.info(`Socket ${socket.id} left attendance session: ${sessionId}`);
    });

    // Admin socket events
    socket.on('admin:subscribe', () => {
      socket.join('admin:notifications');
      logger.info(`Socket ${socket.id} subscribed to admin notifications`);

      // Send welcome notification
      socket.emit('admin:activity', {
        action: 'connected',
        user: 'System',
        resource: 'Admin Panel'
      });
    });

    socket.on('admin:unsubscribe', () => {
      socket.leave('admin:notifications');
      logger.info(`Socket ${socket.id} unsubscribed from admin notifications`);
    });

    socket.on('disconnect', () => {
      logger.info(`WebSocket disconnected: ${socket.id}`);
    });
  });

  // Helper function to emit admin notifications (available globally)
  app.locals.emitAdminNotification = (event: string, data: any) => {
    io.to('admin:notifications').emit(event, data);
  };

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Error handling middleware - MUST be after Vite setup
  app.use(errorHandler);
  
  // 404 handler - MUST be last
  app.use(notFoundHandler);

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = config.port;
  
  // Add graceful shutdown handling
  const gracefulShutdown = () => {
    logger.info('Received shutdown signal, closing server gracefully...');
    server.close((err) => {
      if (err) {
        logger.error('Error during server shutdown:', err);
        process.exit(1);
      }
      logger.info('Server closed successfully');
      process.exit(0);
    });
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
  
  server.listen({
    port,
    host: config.host,
  }, async () => {
    logger.info(`serving on port ${port} in ${process.env.NODE_ENV || 'development'} mode`);
    
    try {
      // Clear rate limits on startup to help users who were locked out
      const { clearRateLimit } = await import('./middleware/security');
      clearRateLimit();
      logger.info('Rate limits cleared on server startup');

      // Initialize HR agents in production
      if (process.env.NODE_ENV === 'production' && config.agents.enabled) {
        const { agentManager } = await import('./agents/agent-manager');
        // AgentManager initializes in constructor, run all agents
        await agentManager.runAllAgents();
      }
      
      // Initialize enhanced Google synchronization
      try {
        const { googleSyncEnhanced } = await import('./services/google-sync-enhanced');
        await googleSyncEnhanced.initialize();
        logger.info('Enhanced Google synchronization initialized with bidirectional sync');

        // Initialize attendance Google sync
        const { initializeAttendanceGoogleSync } = await import('./routes/attendance');
        initializeAttendanceGoogleSync(googleSyncEnhanced);
        logger.info('Attendance Google sync initialized');
      } catch (error) {
        logger.error('Failed to initialize enhanced Google sync:', error);
        // Continue without sync - it's not critical for basic operations
      }

      // Initialize termination reminder job (runs daily at 9 AM)
      try {
        const { startTerminationReminderJob } = await import('./jobs/termination-reminder-job');
        startTerminationReminderJob();
        logger.info('Termination reminder job scheduler started');
      } catch (error) {
        logger.error('Failed to start termination reminder job:', error);
        // Continue - job can be triggered manually via API
      }

      // Initialize PTO reminder job (runs daily at 9 PM EST)
      try {
        const { startPTOReminderJob } = await import('./jobs/pto-reminder-job');
        startPTOReminderJob();
        logger.info('PTO reminder job scheduler started (9 PM EST daily)');
      } catch (error) {
        logger.error('Failed to start PTO reminder job:', error);
        // Continue - job can be triggered manually via API
      }

      // Initialize onboarding overdue tasks checker (runs daily at 9 AM)
      try {
        const { setupOverdueTasksScheduler } = await import('./services/onboarding-notifications');
        setupOverdueTasksScheduler();
        logger.info('Onboarding overdue tasks scheduler started (9 AM daily)');
      } catch (error) {
        logger.error('Failed to start onboarding overdue tasks scheduler:', error);
        // Continue - notifications can be triggered manually via API
      }

      // Initialize interview overdue job (runs daily at 9 AM EST)
      try {
        const { startInterviewOverdueJob } = await import('./jobs/interview-overdue-job');
        startInterviewOverdueJob();
        logger.info('Interview overdue job scheduler started (9 AM EST daily)');
      } catch (error) {
        logger.error('Failed to start interview overdue job:', error);
        // Continue - job can be triggered manually via API
      }

      // Initialize contract reminder job (runs daily at 9 AM)
      try {
        const { startContractReminderJob } = await import('./jobs/contract-reminder-job');
        startContractReminderJob();
        logger.info('Contract reminder job scheduler started (9 AM daily)');
      } catch (error) {
        logger.error('Failed to start contract reminder job:', error);
      }

      // Initialize inventory alert job (runs daily at 8 AM EST)
      try {
        const { startInventoryAlertJob } = await import('./jobs/inventory-alert-job');
        startInventoryAlertJob();
        logger.info('Inventory alert job scheduler started (8 AM EST daily)');
      } catch (error) {
        logger.error('Failed to start inventory alert job:', error);
      }
    } catch (error) {
      logger.error('Error during server initialization:', error);
    }
  });

})().catch((error) => {
  logger.error('Fatal error during startup:', error);
  process.exit(1);
});
