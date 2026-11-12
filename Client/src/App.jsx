import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute, { getDashboardPathByRole } from './components/ProtectedRoute';

import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import LeadDashboard from './pages/LeadDashboard';
import AssistantDashboard from './pages/AssistantDashboard';
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

          {/* Protected Role-Based Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lead"
            element={
              <ProtectedRoute roles={['teamLead']}>
                <LeadDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/assistant"
            element={
              <ProtectedRoute roles={['teamAssistant']}>
                <AssistantDashboard />
              </ProtectedRoute>
            }
          />
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
