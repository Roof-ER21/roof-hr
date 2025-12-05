// Server configuration for different environments

export const config = {
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  
  // Server settings
  port: parseInt(process.env.PORT || '5000', 10),
  host: '0.0.0.0',
  
  // Session configuration
  session: {
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'lax' as const,
  },
  
  // Database
  database: {
    connectionString: process.env.DATABASE_URL!,
    ssl: process.env.NODE_ENV === 'production',
  },
  
  // API settings
  api: {
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per window
    },
  },
  
  // Cron jobs
  cron: {
    enabled: true,
    morningHour: 8,
    eveningHour: 18,
  },
  
  // HR Agents configuration
  agents: {
    enabled: process.env.AGENTS_ENABLED === 'true' || false,
    schedules: {
      ptoExpiration: '0 9 * * 1', // Every Monday at 9 AM
      performanceReview: '0 10 1 */3 *', // First day of quarter at 10 AM
      documentExpiration: '0 8 * * 1,3,5', // Mon/Wed/Fri at 8 AM
      onboarding: 'manual', // Manual trigger only
    },
    maxConcurrent: parseInt(process.env.AGENT_MAX_CONCURRENT || '2', 10),
  },
};

// Validate required environment variables
export function validateConfig() {
  const required = ['DATABASE_URL'];
  
  if (config.isProduction) {
    required.push('SESSION_SECRET');
  }
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}