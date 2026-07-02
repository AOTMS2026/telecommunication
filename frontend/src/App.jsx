import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import MyCalls from './pages/MyCalls';
import Leads from './pages/Leads';
import AddLead from './pages/AddLead';
import Campaigns from './pages/Campaigns';
import CampaignDetail from './pages/CampaignDetail';
import Leaderboard from './pages/Leaderboard';
import Reports from './pages/Reports';
import Tasks from './pages/Tasks';
import Profile from './pages/Profile';
import MessageTemplates from './pages/MessageTemplates';
import Blocklist from './pages/Blocklist';
import MyPreferences from './pages/MyPreferences';
import WhatsApp from './pages/WhatsApp';
import Users from './pages/Users';
import StaleLeads from './pages/StaleLeads';
import BulkImport from './pages/BulkImport';
import TeamOperations from './pages/TeamOperations';
import LeadProfile from './pages/LeadProfile';
import Integrations from './pages/Integrations';
import IntegrationSetup from './pages/IntegrationSetup';
import IntegrationDetail from './pages/IntegrationDetail';
import Workflows from './pages/Workflows';
import Schedules from './pages/Schedules';
import Salesforms from './pages/Salesforms';
import ApiTemplates from './pages/ApiTemplates';
import Webhooks from './pages/Webhooks';
import AccessTokens from './pages/AccessTokens';
import CallIqAgents from './pages/CallIqAgents';
import Mcp from './pages/Mcp';
import LeadStage from './pages/LeadStage';
import Fields from './pages/Fields';
import CallFeedback from './pages/CallFeedback';
import CustomActions from './pages/CustomActions';
import WorkspacePreferences from './pages/WorkspacePreferences';
import PermissionTemplates from './pages/PermissionTemplates';
import N8nSettings from './pages/N8nSettings';
import CallRecordings from './pages/CallRecordings';
import Billing from './pages/Billing';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Loading AOTMS...</p>
      </div>
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : children;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
          <Route path="/reset-password/:token" element={<PublicRoute><ResetPassword /></PublicRoute>} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="my-calls" element={<MyCalls />} />
            <Route path="call-recordings" element={<CallRecordings />} />
            <Route path="billing" element={<Billing />} />
            <Route path="leads" element={<Leads />} />
            <Route path="leads/new" element={<AddLead />} />
            <Route path="leads/:id" element={<LeadProfile />} />
            <Route path="leads/:id/edit" element={<AddLead />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="campaigns/:id" element={<CampaignDetail />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="reports" element={<Reports />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="profile" element={<Profile />} />
            <Route path="message-templates" element={<MessageTemplates />} />
            <Route path="blocklist" element={<Blocklist />} />
            <Route path="my-preferences" element={<MyPreferences />} />
            <Route path="whatsapp" element={<WhatsApp />} />
            <Route path="users" element={<Users />} />
            <Route path="stale-leads" element={<StaleLeads />} />
            <Route path="bulk-import" element={<BulkImport />} />
            <Route path="team-operations" element={<TeamOperations />} />
            <Route path="integrations" element={<Integrations />} />
            <Route path="integrations/setup/:type" element={<IntegrationSetup />} />
            <Route path="integrations/:id" element={<IntegrationDetail />} />
            <Route path="workflows" element={<Workflows />} />
            <Route path="schedules" element={<Schedules />} />
            <Route path="salesforms" element={<Salesforms />} />
            <Route path="api-templates" element={<ApiTemplates />} />
            <Route path="webhooks" element={<Webhooks />} />
            <Route path="access-tokens" element={<AccessTokens />} />
            <Route path="call-iq-agents" element={<CallIqAgents />} />
            <Route path="mcp" element={<Mcp />} />
            <Route path="lead-stage" element={<LeadStage />} />
            <Route path="fields" element={<Fields />} />
            <Route path="call-feedback" element={<CallFeedback />} />
            <Route path="custom-actions" element={<CustomActions />} />
            <Route path="workspace-preferences" element={<WorkspacePreferences />} />
            <Route path="permission-templates" element={<PermissionTemplates />} />
            <Route path="n8n-settings" element={<N8nSettings />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}