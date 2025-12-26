import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import { AuthProvider, useAuth } from '@/lib/auth';
import { queryClient } from '@/lib/queryClient';
import { AppLayout } from '@/components/layout/app-layout';
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
import { SusanFloatingOrb } from '@/components/susan-ai/floating-orb';
import { OnboardingTour } from '@/components/OnboardingTour';
import { useEffect } from 'react';
import '@/lib/api-interceptor';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
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
  
  return <>{children}</>;
}

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
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/employees" element={<EnhancedEmployees />} />
        <Route path="/pto" element={<PTO />} />
        <Route path="/recruiting" element={<EnhancedRecruiting />} />
        <Route path="/recruiting-analytics" element={<RecruitingAnalytics />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/api-test" element={<ApiTest />} />
        {/* Resume uploader is now integrated into the recruiting page */}
        <Route path="/tools" element={<Tools />} />
        <Route path="/email-templates" element={<EmailTemplates />} />
        <Route path="/workflow-builder" element={<WorkflowBuilder />} />
        <Route path="/territories" element={<Territories />} />
        <Route path="/pto-policies" element={<PtoPolicies />} />
        <Route path="/coi-documents" element={<CoiDocuments />} />
        <Route path="/employee-assignments" element={<EmployeeAssignments />} />
        <Route path="/contracts" element={<Contracts />} />
        <Route path="/susan-ai" element={<SusanAI />} />
        <Route path="/susan-ai-admin" element={<SusanAIAdmin />} />
        <Route path="/google-integration" element={<Navigate to="/settings?tab=google" replace />} />
        <Route path="/attendance" element={<AttendanceDashboard />} />
        <Route path="/attendance/admin" element={<AttendanceAdminDashboard />} />
        <Route path="/my-portal" element={<EmployeeDashboard />} />
        <Route path="/team-directory" element={<TeamDirectory />} />
        <Route path="/team-dashboard" element={<TeamDashboard />} />
        <Route path="/meeting-rooms" element={<MeetingRooms />} />
        <Route path="/onboarding-templates" element={<OnboardingTemplates />} />
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
