## Overview

This is a full-stack HR management system for ROOF-ER roofing company, built with Express.js, React, and TypeScript. It utilizes Drizzle ORM with PostgreSQL, TanStack React Query, and shadcn/ui. The system streamlines HR operations by providing comprehensive employee management, document handling, performance tracking, and recruitment. Key features include PTO management, Tools & Equipment Management, and a Smart Recruitment Bot with AI-powered enhancements (e.g., resume parsing, candidate prediction, salary benchmarking) using OpenAI GPT-4o. It integrates robust authentication with role-based access control and offers automated employee onboarding and bidirectional synchronization with Google services (Sheets, Drive, Calendar, Gmail). The primary purpose is to provide a comprehensive and intelligent platform for managing the entire employee lifecycle.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript, Vite
- **Styling**: Tailwind CSS with shadcn/ui components (Radix UI primitives), Lucide React for icons
- **State Management**: TanStack React Query
- **Forms**: React Hook Form with Zod validation

### Backend
- **Framework**: Express.js with TypeScript, Node.js (ESM)
- **Database**: PostgreSQL with Drizzle ORM
- **API**: RESTful, Zod for input validation, comprehensive error handling

### Core System Design
- **Project Structure**: Monorepo (`client/`, `server/`, `shared/`, `migrations/`, `attached_assets/`)
- **Authentication**: JWT-based with `connect-pg-simple` for session storage and robust role-based access control (RBAC) for Admins, Managers, and Employees.
- **HR Feature Specifications**:
    - **Employee Management**: Comprehensive directory, CRUD, search, filter, analytics, import/export.
    - **Document Management**: Version control, role-based access, expiration tracking.
    - **Performance Tracking**: Review system with star ratings and automated generation.
    - **PTO Management**: Three-level policy system (Company, Department, Individual) with consolidated configuration, blackout date validation, approval workflow, and overlap detection. Managed via dedicated PTO Management page.
    - **Recruitment**: Kanban/list views, bulk actions, interview scheduling, AI-powered candidate matching/prediction, automated emails, candidate import, status system with screening.
    - **Tools & Equipment Management**: Inventory management, employee assignment, real-time tracking, Google Sheets sync.
    - **Smart Recruitment Bot**: OpenAI GPT-4o powered for candidate validation, inconsistency detection, idle candidate monitoring, and suggested next steps.
    - **HR Automation Agents**: PTO Expiration, Performance Review, Document Expiration, Onboarding Agent.
    - **Enhanced Security**: Rate limiting, input sanitization, CSRF protection, structured logging.
    - **Advanced Analytics**: Custom report generation, performance metrics, automated scheduling.
    - **Territory Management**: Create/manage sales territories, assign managers, track employees.
    - **COI Document Tracking**: Workers Compensation & General Liability tracking with alerts.
    - **Employee Assignment System**: Define reporting structures, manage primary/secondary/temporary assignments.
    - **Contract Management**: Creation/template system, e-signature support, status tracking.
    - **Email Template Management**: Full CRUD, dynamic variables, live preview, role-based access.
    - **Visual Workflow Builder**: Drag-and-drop interface for workflow design.
    - **Employee Onboarding Automation**: Automated system with welcome pack bundles (adjusts inventory).
    - **Inventory Alert System**: Configurable thresholds for low stock alerts.
    - **Susan AI (JARVIS-like Assistant)**:
        - **Unified Admin Interface**: Single `/susan-ai` page providing comprehensive system control, analytics, agent management, and conversational command center for administrators.
        - **Role-Based Experience**: Adapts interface based on user role (admin vs. employee).
        - **Floating Orb Interface**: Provides quick actions and direct access to Susan AI.
        - **Context-Aware Intelligence**: Understands user role, territory, department.
        - **Action Capabilities**: Can send emails, move candidates, approve PTO, generate reports, control HR agents.
        - **HR Agent Controller**: Centralized management for all HR automation agents.
        - **Comprehensive Analytics**: Built-in dashboard with real-time metrics.
        - **Knowledge Base**: Contains HR policies, benefits, safety protocols.
        - **OpenAI GPT-4o Integration**: Powered by GPT-4o for advanced reasoning and task execution.

## External Dependencies

### Core
- **Database**: `@neondatabase/serverless` (PostgreSQL)
- **ORM**: `drizzle-orm`, `drizzle-zod`
- **UI Libraries**: `@radix-ui/react-*`, `shadcn/ui`
- **State Management**: `@tanstack/react-query`
- **Form Management**: `react-hook-form`, `@hookform/resolvers`
- **Validation**: `zod`
- **Styling**: `tailwindcss`, `class-variance-authority`
- **Icons**: `lucide-react`
- **Drag-and-Drop**: `@dnd-kit/core`, `@dnd-kit/sortable`
- **AI Integration**: OpenAI GPT-4o
- **Google Services Integration**:
  - **Gmail**: OAuth2 with theroofdocs.com domain
  - **Google Calendar**: Event management, interview scheduling
  - **Google Sheets**: Tools inventory export/import
  - **Google Drive**: Document storage, HR folder structure
  - **Google Docs**: Contract/performance review generation (PDF/HTML export)
  - **Authentication**: `googleapis`, `google-auth-library` (OAuth2 service account)

### Development Tools
- **Language**: `TypeScript`
- **Frontend Build**: `Vite`
- **Backend Runtime/Build**: `tsx`, `esbuild`
- **Code Quality**: `ESLint`, `Prettier`
- **Testing**: `Jest`, `Supertest`
- **Security**: `helmet`, `express-rate-limit`, `cors`
- **Logging**: `Winston`
- **Scheduling**: `node-cron`