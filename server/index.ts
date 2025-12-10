import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import session from "express-session";
import passport from "passport";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

import { storage } from "./storage";
import { testConnection } from "./db";
import bcrypt from 'bcrypt';
import { config, validateConfig } from './config';
import { rateLimit, sanitizeInput, configureCORS, securityLogger, clearRateLimit } from './middleware/security';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { requestLogger, logger } from './middleware/logger';

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

const app = express();

// Trust proxy headers (needed for Replit and other proxied environments)
app.set('trust proxy', true);

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

(async () => {
  // Global error handlers
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
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
    
    socket.on('disconnect', () => {
      logger.info(`WebSocket disconnected: ${socket.id}`);
    });
  });

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
      
      // Production initialization - create admin user if not exists
      await createAdminUser();
      
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
    } catch (error) {
      logger.error('Error during server initialization:', error);
    }
  });

})().catch((error) => {
  logger.error('Fatal error during startup:', error);
  process.exit(1);
});
