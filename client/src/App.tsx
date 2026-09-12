import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import { AuthProvider, useAuth } from '@/lib/auth';
import { queryClient } from '@/lib/queryClient';
import { AppLayout } from '@/components/layout/app-layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ADMIN_ROLES, MANAGER_ROLES, ONBOARDING_ADMIN_EMAILS, canAccessFacilities } from '@shared/constants/roles';
import ChangePassword from '@/pages/change-password';
import Login from '@/pages/login';
import { useEffect, lazy, Suspense } from 'react';
import '@/lib/api-interceptor';

// ─── Route chunks ────────────────────────────────────────────────────────────
//
// Every page used to be a static import, so one 2.75 MB chunk carried the
// super-admin console, the SQL runner, the workflow builder, Recharts and the
// QR poster rasteriser to someone who only wanted to see their PTO balance.
// Each route is its own chunk now; Login and ChangePassword stay eager because
// the auth gate renders them before any route matches.

// The orb and the tour are the only two framer-motion consumers reachable from
// the shell. Kept lazy so framer-motion stays out of the entry chunk.
const SusanFloatingOrb = lazy(() => import('@/components/susan-ai/floating-orb').then(m => ({ default: m.SusanFloatingOrb })));
const OnboardingTour = lazy(() => import('@/components/OnboardingTour').then(m => ({ default: m.OnboardingTour })));
const Dashboard = lazy(() => import('@/pages/dashboard'));
const EnhancedEmployees = lazy(() => import('@/pages/enhanced-employees'));
const PTO = lazy(() => import('@/pages/pto'));
const EnhancedRecruiting = lazy(() => import('@/pages/enhanced-recruiting'));
const RecruitingAnalytics = lazy(() => import('@/pages/RecruitingAnalytics'));
const Documents = lazy(() => import('@/pages/documents'));
const Reviews = lazy(() => import('@/pages/reviews'));
const Settings = lazy(() => import('@/pages/settings'));
const ConnectAgent = lazy(() => import('@/pages/connect-agent'));
const ApiTest = lazy(() => import('@/pages/api-test'));
const Tasks = lazy(() => import('@/pages/tasks'));
const QRCodes = lazy(() => import('@/pages/qr-codes'));
const Marketing = lazy(() => import('@/pages/Marketing'));
const MarketingCampaigns = lazy(() => import('@/pages/MarketingCampaigns'));
const MarketingTemplates = lazy(() => import('@/pages/MarketingTemplates'));
const Tools = lazy(() => import('@/pages/Tools').then(m => ({ default: m.Tools })));
const EmailTemplates = lazy(() => import('@/pages/EmailTemplates'));
const WorkflowBuilder = lazy(() => import('@/pages/WorkflowBuilder'));
const Territories = lazy(() => import('@/pages/Territories'));
const PtoPolicies = lazy(() => import('@/pages/PtoPolicies'));
const CoiDocuments = lazy(() => import('@/pages/CoiDocuments'));
const EmployeeAssignments = lazy(() => import('@/pages/EmployeeAssignments'));
const Contracts = lazy(() => import('@/pages/Contracts'));
const SusanAI = lazy(() => import('@/pages/susan-ai'));
const SusanAIAdmin = lazy(() => import('@/pages/susan-ai-admin'));
const AttendanceDashboard = lazy(() => import('@/pages/AttendanceDashboard'));
const AttendanceCheckIn = lazy(() => import('@/pages/AttendanceCheckIn'));
const AttendanceAdminDashboard = lazy(() => import('@/pages/AttendanceAdminDashboard'));
const EquipmentChecklistForm = lazy(() => import('@/pages/equipment-checklist-form'));
const EquipmentAgreementForm = lazy(() => import('@/pages/equipment-agreement-form'));
const EquipmentReturnForm = lazy(() => import('@/pages/equipment-return-form'));
const PublicContractPage = lazy(() => import('@/pages/public-contract'));
const SignEquipmentReceipt = lazy(() => import('@/pages/sign-equipment-receipt'));
const EmployeeDashboard = lazy(() => import('@/pages/employee-dashboard'));
const TeamDirectory = lazy(() => import('@/pages/team-directory'));
const TeamDashboard = lazy(() => import('@/pages/team-dashboard'));
const MeetingRooms = lazy(() => import('@/pages/MeetingRooms'));
const OnboardingTemplates = lazy(() => import('@/pages/OnboardingTemplates'));
const OrgChartPage = lazy(() => import('@/pages/OrgChartPage'));



// Shown while a route chunk is in flight. Deliberately quiet: no spinner on a
// fast connection, because a chunk that arrives in 80ms should not flash a
// loading state at anyone. aria-busy lets a screen reader know something is
// pending without announcing it repeatedly.
function RouteFallback() {
  return (
    <div
      className="min-h-[60vh] flex items-center justify-center"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading</span>
    </div>
  );
}

function AuthenticatedRoutes() {
  const { user, isLoading, isInitialized } = useAuth();
  const facilitiesAccess = canAccessFacilities(user);

  if (!isInitialized || isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        role="status"
        aria-live="polite"
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  // Check if user must change password
  if (user.mustChangePassword) {
    return <ChangePassword />;
  }
  
  return (
    <AppLayout>
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Dashboard: Admin/Manager only */}
        <Route path="/" element={
          <ProtectedRoute requiredRoles={MANAGER_ROLES}>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute requiredRoles={MANAGER_ROLES}>
            <Dashboard />
          </ProtectedRoute>
        } />

        {/* Employees: Admin/Manager only */}
        <Route path="/employees" element={
          <ProtectedRoute requiredRoles={MANAGER_ROLES}>
            <EnhancedEmployees />
          </ProtectedRoute>
        } />

        {/* PTO: Everyone can access */}
        {/* Connecting another Roof-ER app to Roof HR, as yourself. Any signed-in
            role may reach it; the server decides what they can actually grant. */}
        <Route path="/connect/agent" element={<ConnectAgent />} />
        <Route path="/pto" element={<PTO />} />

        {/* Tasks: Everyone (API scopes — employees see their own, managers see all) */}
        <Route path="/tasks" element={<Tasks />} />

        {/* QR Codes: Everyone (API scopes — a rep sees only their own row) */}
        <Route path="/qr-codes" element={<QRCodes />} />

        {/* Marketing hub: Overview (managers); reps are redirected to /qr-codes by the page */}
        <Route path="/marketing" element={<Marketing />} />
        <Route path="/marketing/campaigns" element={<MarketingCampaigns />} />
        <Route path="/marketing/templates" element={<MarketingTemplates />} />

        {/* Recruiting: Everyone can access (SOURCER sees their assigned candidates) */}
        <Route path="/recruiting" element={<EnhancedRecruiting />} />
        <Route path="/recruiting-analytics" element={<RecruitingAnalytics />} />

        {/* Documents: Admin/Manager/Employee */}
        <Route path="/documents" element={
          <ProtectedRoute requiredRoles={[...MANAGER_ROLES, 'EMPLOYEE']}>
            <Documents />
          </ProtectedRoute>
        } />

        {/* Reviews: Admin only */}
        <Route path="/reviews" element={
          <ProtectedRoute requiredRoles={ADMIN_ROLES}>
            <Reviews />
          </ProtectedRoute>
        } />

        {/* Settings: Admin only */}
        <Route path="/settings" element={
          <ProtectedRoute requiredRoles={ADMIN_ROLES}>
            <Settings />
          </ProtectedRoute>
        } />

        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/api-test" element={<ApiTest />} />

        {/* Tools: Admin/Manager only */}
        <Route path="/tools" element={
          <ProtectedRoute requiredRoles={MANAGER_ROLES}>
            <Tools />
          </ProtectedRoute>
        } />

        {/* Email Templates: Admin/Manager only */}
        <Route path="/email-templates" element={
          <ProtectedRoute requiredRoles={MANAGER_ROLES}>
            <EmailTemplates />
          </ProtectedRoute>
        } />

        {/* Workflow Builder: Admin/Manager only */}
        <Route path="/workflow-builder" element={
          <ProtectedRoute requiredRoles={MANAGER_ROLES}>
            <WorkflowBuilder />
          </ProtectedRoute>
        } />

        {/* Territories: Admin only */}
        <Route path="/territories" element={
          <ProtectedRoute requiredRoles={ADMIN_ROLES}>
            <Territories />
          </ProtectedRoute>
        } />

        {/* PTO Policies: Admin only */}
        <Route path="/pto-policies" element={
          <ProtectedRoute requiredRoles={ADMIN_ROLES}>
            <PtoPolicies />
          </ProtectedRoute>
        } />

        {/* COI Documents: Admin only */}
        <Route path="/coi-documents" element={
          <ProtectedRoute requiredRoles={ADMIN_ROLES}>
            <CoiDocuments />
          </ProtectedRoute>
        } />

        {/* Employee Assignments: Admin only */}
        <Route path="/employee-assignments" element={
          <ProtectedRoute requiredRoles={ADMIN_ROLES}>
            <EmployeeAssignments />
          </ProtectedRoute>
        } />

        {/* Contracts: Admin/Manager/Employee */}
        <Route path="/contracts" element={
          <ProtectedRoute requiredRoles={[...MANAGER_ROLES, 'EMPLOYEE']}>
            <Contracts />
          </ProtectedRoute>
        } />

        {/* Susan AI: Everyone can access */}
        <Route path="/susan-ai" element={<SusanAI />} />
        <Route path="/susan-ai-admin" element={
          <ProtectedRoute requiredRoles={ADMIN_ROLES}>
            <SusanAIAdmin />
          </ProtectedRoute>
        } />

        <Route path="/google-integration" element={<Navigate to="/settings?tab=google" replace />} />

        {/* Attendance: Admin + Facilities access */}
        <Route path="/attendance" element={
          facilitiesAccess ? <AttendanceDashboard /> : <Navigate to="/my-portal" replace />
        } />
        <Route path="/attendance/admin" element={
          <ProtectedRoute requiredRoles={ADMIN_ROLES}>
            <AttendanceAdminDashboard />
          </ProtectedRoute>
        } />

        {/* My Portal: Everyone can access */}
        <Route path="/my-portal" element={<EmployeeDashboard />} />

        {/* Team Directory: Everyone can access (read-only) */}
        <Route path="/team-directory" element={<TeamDirectory />} />
        <Route path="/org-chart" element={<OrgChartPage />} />

        {/* Team Dashboard: Admin/Manager only */}
        <Route path="/team-dashboard" element={
          <ProtectedRoute requiredRoles={MANAGER_ROLES}>
            <TeamDashboard />
          </ProtectedRoute>
        } />

        {/* Meeting Rooms: Admin + Facilities access */}
        <Route path="/meeting-rooms" element={
          facilitiesAccess ? <MeetingRooms /> : <Navigate to="/my-portal" replace />
        } />

        {/* Onboarding Templates: Specific emails only */}
        <Route path="/onboarding-templates" element={
          <ProtectedRoute requiredEmails={ONBOARDING_ADMIN_EMAILS}>
            <OnboardingTemplates />
          </ProtectedRoute>
        } />

        <Route path="/scheduled-reports" element={<Navigate to="/settings?tab=reports" replace />} />
        <Route path="/my-calendar" element={<Navigate to="/my-portal" replace />} />
      </Routes>
      <Suspense fallback={null}>
        <SusanFloatingOrb />
        <OnboardingTour />
      </Suspense>
      </Suspense>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Public routes - no authentication required */}
            <Route path="/attendance/check-in" element={<AttendanceCheckIn />} />
            <Route path="/equipment-checklist/:token" element={<EquipmentChecklistForm />} />
            <Route path="/equipment-agreement/:token" element={<EquipmentAgreementForm />} />
            <Route path="/equipment-return/:token" element={<EquipmentReturnForm />} />
            <Route path="/contract/:token" element={<PublicContractPage />} />
            <Route path="/sign-equipment/:token" element={<SignEquipmentReceipt />} />
            <Route path="/login" element={<Login />} />

            {/* Protected routes - require authentication */}
            <Route path="/*" element={<AuthenticatedRoutes />} />
          </Routes>
          </Suspense>
          <Toaster />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
