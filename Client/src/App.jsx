import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute, { getDashboardPathByRole } from './components/ProtectedRoute';
import AppShell from './components/shell/AppShell';

import Login from './pages/Login';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminTeams from './pages/admin/AdminTeams';
import AdminTeamDetail from './pages/admin/AdminTeamDetail';
import AdminCriteria from './pages/admin/AdminCriteria';
import AdminEntries from './pages/admin/AdminEntries';

import HeadLayout from './pages/head/HeadLayout';
import HeadOverview from './pages/head/HeadOverview';
import HeadApprovals from './pages/head/HeadApprovals';
import HeadHistory from './pages/head/HeadHistory';

import AssistantLayout from './pages/assistant/AssistantLayout';
import AssistantOverview from './pages/assistant/AssistantOverview';
import AssistantNewEntry from './pages/assistant/AssistantNewEntry';
import AssistantTeamPoints from './pages/assistant/AssistantTeamPoints';
import AssistantSubmissions from './pages/assistant/AssistantSubmissions';

import MemberDashboard from './pages/MemberDashboard';
import Leaderboard from './pages/Leaderboard';
import TeamScorecard from './pages/TeamScorecard';
import GameCriteria from './pages/GameCriteria';
import MeetingsList from './pages/meetings/MeetingsList';
import MeetingSheet from './pages/meetings/MeetingSheet';
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
  const [toastPosition, setToastPosition] = useState(
    typeof window !== 'undefined' && window.innerWidth < 1024 ? 'bottom-center' : 'top-right'
  );

  useEffect(() => {
    const handleResize = () => {
      setToastPosition(window.innerWidth < 1024 ? 'bottom-center' : 'top-right');
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position={toastPosition}
          containerStyle={{
            top: toastPosition === 'top-right' ? 72 : undefined,
            bottom: toastPosition === 'bottom-center' ? 24 : undefined,
          }}
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1e293b',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 500,
              borderRadius: '8px',
              padding: '10px 14px',
              border: '1px solid #334155',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
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
            <Route path="meetings" element={<MeetingsList />} />
            <Route path="meetings/:id" element={<MeetingSheet />} />
          </Route>

          {/* Protected Team Head Routes */}
          <Route
            path="/head"
            element={
              <ProtectedRoute roles={['teamHead']}>
                <HeadLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<HeadOverview />} />
            <Route path="approvals" element={<HeadApprovals />} />
            <Route path="history" element={<HeadHistory />} />
            <Route path="scorecard" element={<TeamScorecard />} />
            <Route path="meetings" element={<MeetingsList />} />
            <Route path="meetings/:id" element={<MeetingSheet />} />
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
            <Route path="scorecard" element={<TeamScorecard />} />
            <Route path="team-points" element={<Navigate to="/assistant/scorecard" replace />} />
            <Route path="submissions" element={<AssistantSubmissions />} />
            <Route path="meetings" element={<MeetingsList />} />
            <Route path="meetings/:id" element={<MeetingSheet />} />
          </Route>

          {/* Protected Member Route */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute roles={['member', 'admin', 'teamHead', 'teamAssistant']}>
                <AppShell>
                  <MemberDashboard />
                </AppShell>
              </ProtectedRoute>
            }
          />

          {/* Shared Game Criteria Route for ALL Authenticated Roles */}
          <Route
            path="/criteria"
            element={
              <ProtectedRoute roles={['admin', 'teamHead', 'teamAssistant', 'member']}>
                <AppShell>
                  <GameCriteria />
                </AppShell>
              </ProtectedRoute>
            }
          />

          {/* Shared Leaderboard Route for ALL Roles */}
          <Route
            path="/leaderboard"
            element={
              <ProtectedRoute roles={['admin', 'teamHead', 'teamAssistant', 'member']}>
                <AppShell>
                  <Leaderboard />
                </AppShell>
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
