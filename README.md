# ROOF-ER HR Management System

A comprehensive HR management platform designed for ROOF-ER roofing company, featuring sales performance tracking, employee management, and recruitment workflows.

## Features

- **Sales Leaderboard**: Track sales representatives' performance with monthly revenue and signup goals
- **QR Code System**: Generate unique QR codes for sales reps to track lead conversions
- **Employee Management**: Manage employee profiles, documents, and reviews
- **PTO Management**: Handle paid time off requests and approvals
- **Recruitment Pipeline**: Track candidates through the hiring process
- **Task Management**: Assign and track tasks across teams
- **Employee Reviews**: Conduct quarterly and annual performance reviews

## Tech Stack

- **Frontend**: React with TypeScript, Vite, TailwindCSS, shadcn/ui
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Session-based with bcrypt password hashing
- **State Management**: TanStack React Query

## Prerequisites

- Node.js 20.x or higher
- PostgreSQL database (Neon or self-hosted)
- npm or yarn

## Environment Variables

Create a `.env` file based on `.env.example`:

```bash
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
SESSION_SECRET=your-session-secret-here
NODE_ENV=production
PORT=5000
```

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Push database schema:
   ```bash
   npm run db:push
   ```

## Development

Run the development server:
```bash
npm run dev
```

The application will be available at http://localhost:5000

## Production Build

1. Build the application:
   ```bash
   npm run build
   ```

2. Start the production server:
   ```bash
   npm start
   ```

## Default Demo Accounts

For testing purposes, the following demo accounts are available:

- **Admin**: admin@roof-er.com / admin123
- **Manager**: manager@roof-er.com / manager123
- **Employee**: employee@roof-er.com / employee123

## Features Overview

### Sales Management
- Real-time leaderboard with monthly and yearly views
- 6-tier bonus system based on signup achievements
- Automated goal tracking and pace calculations
- QR code generation for lead tracking

### HR Functions
- Employee profile management
- Document storage and expiration tracking
- PTO request workflow
- Performance review system
- Task assignment and tracking

### Recruitment
- Kanban-style candidate pipeline
- Interview scheduling
- Document management
- Stage progression tracking

## API Endpoints

The application exposes RESTful API endpoints:

- `/api/auth/*` - Authentication endpoints
- `/api/users/*` - User management
- `/api/leaderboard/*` - Sales leaderboard data
- `/api/pto/*` - PTO request management
- `/api/candidates/*` - Recruitment pipeline
- `/api/reviews/*` - Employee reviews
- `/api/tasks/*` - Task management

## Database Schema

The application uses PostgreSQL with the following main tables:
- `users` - Employee and user accounts
- `sales_reps` - Sales performance data
- `bonus_config` - Bonus tier configurations
- `pto_requests` - Time off requests
- `candidates` - Recruitment candidates
- `employee_reviews` - Performance reviews
- `tasks` - Task assignments

## Deployment

The application is designed to run on Replit or any Node.js hosting platform:

1. Set environment variables
2. Build the application
3. Run the production server on port 5000

## Support

For issues or questions, please contact the development team.

## License

Proprietary - ROOF-ER Roofing Company