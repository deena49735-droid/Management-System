import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute, { getDashboardPathByRole } from './components/ProtectedRoute';

import Login from './pages/Login';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminTeams from './pages/admin/AdminTeams';
import AdminTeamDetail from './pages/admin/AdminTeamDetail';
import AdminCriteria from './pages/admin/AdminCriteria';
import AdminEntries from './pages/admin/AdminEntries';

import LeadLayout from './pages/lead/LeadLayout';
import LeadOverview from './pages/lead/LeadOverview';
import LeadApprovals from './pages/lead/LeadApprovals';
import LeadHistory from './pages/lead/LeadHistory';

import AssistantLayout from './pages/assistant/AssistantLayout';
import AssistantOverview from './pages/assistant/AssistantOverview';
import AssistantNewEntry from './pages/assistant/AssistantNewEntry';
import AssistantTeamPoints from './pages/assistant/AssistantTeamPoints';
import AssistantSubmissions from './pages/assistant/AssistantSubmissions';

import MemberDashboard from './pages/MemberDashboard';
import NotFound from './pages/NotFound';

/**
 * Root route handler: Redirects authenticated users to their role dashboard
 * or unauthenticated users to /login
 */
const RootRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="text-sm font-medium text-slate-500">Loading Kadambas Game...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to={getDashboardPathByRole(user.role)} replace />;
  }

  return <Navigate to="/login" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3500,
            style: {
              background: '#1e293b',
              color: '#fff',
              fontSize: '14px',
              borderRadius: '12px',
              padding: '12px 16px',
            },
          }}
        />
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RootRoute />} />

          {/* Protected Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="teams" element={<AdminTeams />} />
            <Route path="teams/:id" element={<AdminTeamDetail />} />
            <Route path="criteria" element={<AdminCriteria />} />
            <Route path="entries" element={<AdminEntries />} />
          </Route>

          {/* Protected Team Lead Routes */}
          <Route
            path="/lead"
            element={
              <ProtectedRoute roles={['teamLead']}>
                <LeadLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<LeadOverview />} />
            <Route path="approvals" element={<LeadApprovals />} />
            <Route path="history" element={<LeadHistory />} />
          </Route>

          {/* Protected Team Assistant Routes */}
          <Route
            path="/assistant"
            element={
              <ProtectedRoute roles={['teamAssistant']}>
                <AssistantLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AssistantOverview />} />
            <Route path="entries/new" element={<AssistantNewEntry />} />
            <Route path="team-points" element={<AssistantTeamPoints />} />
            <Route path="submissions" element={<AssistantSubmissions />} />
          </Route>

          {/* Protected Member Route */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute roles={['member', 'admin', 'teamLead', 'teamAssistant']}>
                <MemberDashboard />
              </ProtectedRoute>
            }
          />

          {/* 404 Catch-All Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
