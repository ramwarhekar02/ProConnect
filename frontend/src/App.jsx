import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, AuthProvider } from './hooks/AuthContext.jsx';
import { useSocket } from './hooks/useSocket';

// Pages
import { LoginPage } from './pages/Login/LoginPage';
import { DashboardPage } from './pages/Dashboard/DashboardPage';
import { MachinesPage } from './pages/Machines/MachinesPage';
import { OEEPage } from './pages/OEE/OEEPage';
import { ReportsPage } from './pages/Reports/ReportsPage';
import { SettingsPage } from './pages/Settings/SettingsPage';

// Layout
import { MainLayout } from './layout/MainLayout';

const ProtectedRoute = ({ children, isAuthenticated }) => {
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

function AppContent() {
  const { admin, loading, logout } = useAuth();
  const { isConnected } = useSocket();

  useEffect(() => {
    if (admin) {
      console.log('User authenticated:', admin.username);
    }
  }, [admin]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400 text-lg">Loading application...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Login Route */}
        <Route
          path="/login"
          element={admin ? <Navigate to="/dashboard" replace /> : <LoginPage />}
        />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute isAuthenticated={!!admin}>
              <MainLayout onLogout={logout}>
                <DashboardPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/machines"
          element={
            <ProtectedRoute isAuthenticated={!!admin}>
              <MainLayout onLogout={logout}>
                <MachinesPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/oee"
          element={
            <ProtectedRoute isAuthenticated={!!admin}>
              <MainLayout onLogout={logout}>
                <OEEPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports"
          element={
            <ProtectedRoute isAuthenticated={!!admin}>
              <MainLayout onLogout={logout}>
                <ReportsPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <MainLayout onLogout={logout}>
              <SettingsPage />
            </MainLayout>
          }
        />

        {/* Default Route */}
        <Route
          path="/"
          element={
            <Navigate
              to={admin ? '/dashboard' : '/login'}
              replace
            />
          }
        />

        {/* 404 Route */}
        <Route
          path="*"
          element={
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-white mb-4">404</h1>
                <p className="text-gray-400 mb-6">Page not found</p>
                <a
                  href={admin ? '/dashboard' : '/login'}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition"
                >
                  Go Home
                </a>
              </div>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}


function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
