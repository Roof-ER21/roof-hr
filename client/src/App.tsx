import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import { AuthProvider, useAuth } from '@/lib/auth';
import { queryClient } from '@/lib/queryClient';
import { AppLayout } from '@/components/layout/app-layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ADMIN_ROLES, MANAGER_ROLES, ONBOARDING_ADMIN_EMAILS } from '@shared/constants/roles';
import Dashboard from '@/pages/dashboard';
import EnhancedEmployees from '@/pages/enhanced-employees';
import PTO from '@/pages/pto';
import EnhancedRecruiting from '@/pages/enhanced-recruiting';
import RecruitingAnalytics from '@/pages/RecruitingAnalytics';
import Documents from '@/pages/documents';
import Reviews from '@/pages/reviews';
import ChangePassword from '@/pages/change-password';
import Settings from '@/pages/settings';
import Login from '@/pages/login';
import ApiTest from '@/pages/api-test';
// ResumeUploader is now integrated into EnhancedRecruiting page
// import ResumeUploader from '@/pages/resume-uploader';
import { Tools } from '@/pages/Tools';
import EmailTemplates from '@/pages/EmailTemplates';
import WorkflowBuilder from '@/pages/WorkflowBuilder';
import Territories from '@/pages/Territories';
import PtoPolicies from '@/pages/PtoPolicies';
import CoiDocuments from '@/pages/CoiDocuments';
import EmployeeAssignments from '@/pages/EmployeeAssignments';
import Contracts from '@/pages/Contracts';
import SusanAI from '@/pages/susan-ai';
import SusanAIAdmin from '@/pages/susan-ai-admin';
import GoogleIntegration from '@/pages/GoogleIntegration';
import AttendanceDashboard from '@/pages/AttendanceDashboard';
import AttendanceCheckIn from '@/pages/AttendanceCheckIn';
import AttendanceAdminDashboard from '@/pages/AttendanceAdminDashboard';
import EquipmentChecklistForm from '@/pages/equipment-checklist-form';
import EquipmentAgreementForm from '@/pages/equipment-agreement-form';
import EquipmentReturnForm from '@/pages/equipment-return-form';
import EmployeeDashboard from '@/pages/employee-dashboard';
import TeamDirectory from '@/pages/team-directory';
import TeamDashboard from '@/pages/team-dashboard';
import MeetingRooms from '@/pages/MeetingRooms';
import OnboardingTemplates from '@/pages/OnboardingTemplates';
import ScheduledReports from '@/pages/ScheduledReports';
import OrgChartPage from '@/pages/OrgChartPage';
import { SusanFloatingOrb } from '@/components/susan-ai/floating-orb';
import { OnboardingTour } from '@/components/OnboardingTour';
import { useEffect } from 'react';
import '@/lib/api-interceptor';


function AuthenticatedRoutes() {
  const { user, isLoading, isInitialized } = useAuth();
  
  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
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
        <Route path="/pto" element={<PTO />} />

        {/* Recruiting: Everyone can access (SOURCER sees their assigned candidates) */}
        <Route path="/recruiting" element={<EnhancedRecruiting />} />
        <Route path="/recruiting-analytics" element={<RecruitingAnalytics />} />

        {/* Documents: Admin/Manager only */}
        <Route path="/documents" element={
          <ProtectedRoute requiredRoles={MANAGER_ROLES}>
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

        {/* Contracts: Admin/Manager only */}
        <Route path="/contracts" element={
          <ProtectedRoute requiredRoles={MANAGER_ROLES}>
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

        {/* Attendance: Admin only */}
        <Route path="/attendance" element={
          <ProtectedRoute requiredRoles={ADMIN_ROLES}>
            <AttendanceDashboard />
          </ProtectedRoute>
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

        {/* Meeting Rooms: Admin only */}
        <Route path="/meeting-rooms" element={
          <ProtectedRoute requiredRoles={ADMIN_ROLES}>
            <MeetingRooms />
          </ProtectedRoute>
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
      <SusanFloatingOrb />
      <OnboardingTour />
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes - no authentication required */}
            <Route path="/attendance/check-in" element={<AttendanceCheckIn />} />
            <Route path="/equipment-checklist/:token" element={<EquipmentChecklistForm />} />
            <Route path="/equipment-agreement/:token" element={<EquipmentAgreementForm />} />
            <Route path="/equipment-return/:token" element={<EquipmentReturnForm />} />
            <Route path="/login" element={<Login />} />

            {/* Protected routes - require authentication */}
            <Route path="/*" element={<AuthenticatedRoutes />} />
          </Routes>
          <Toaster />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
