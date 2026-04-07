import { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { useAuth } from './hooks/useAuth';
import { Toaster } from 'react-hot-toast';

// Lazy load pages for performance
const Login = lazy(() => import('./pages/Login.jsx'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx'));
const TeacherDashboard = lazy(() => import('./pages/TeacherDashboard.jsx'));
const ParentDashboard = lazy(() => import('./pages/ParentDashboard.jsx'));
const VerifyBulletin = lazy(() => import('./pages/VerifyBulletin.jsx'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false }
  }
});

// Premium loading fallback
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-gold-50/30">
    <div className="text-center">
      <div className="w-16 h-16 mx-auto mb-4 bg-royal-gradient rounded-2xl flex items-center justify-center animate-pulse shadow-glass-lg">
        <svg className="w-8 h-8 text-gold-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c6 3 10 0 12-1v-4" />
        </svg>
      </div>
      <p className="text-gray-500 font-medium text-sm animate-pulse">Chargement...</p>
    </div>
  </div>
);

function ProtectedRoute({ children, roles }) {
  const { user, role, loading } = useAuth();

  if (loading || (user && !role)) return <LoadingFallback />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(role)) return <Navigate to="/unauthorized" replace />;
  return children;
}

function RoleRedirect() {
  const { user, role, loading } = useAuth();

  if (loading || (user && !role)) return <LoadingFallback />;
  if (!user) return <Navigate to="/login" replace />;

  switch (role) {
    case 'admin': return <Navigate to="/admin" replace />;
    case 'teacher': return <Navigate to="/teacher" replace />;
    case 'parent': return <Navigate to="/parent" replace />;
    default: return <Navigate to="/login" replace />;
  }
}

function AppContent() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return (
    <Router>
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-red-500 text-white text-center py-2 text-sm font-bold flex items-center justify-center gap-2 shadow-md">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 00-12.728 0M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Mode Hors-Ligne : Aucune connexion internet (V&eacute;rifiez votre r&eacute;seau ou antivirus)
        </div>
      )}
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Admin routes */}
          <Route path="/admin/*" element={
            <ProtectedRoute roles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />

          {/* Teacher routes */}
          <Route path="/teacher/*" element={
            <ProtectedRoute roles={['teacher']}>
              <TeacherDashboard />
            </ProtectedRoute>
          } />

          {/* Parent routes */}
          <Route path="/parent/*" element={
            <ProtectedRoute roles={['parent']}>
              <ParentDashboard />
            </ProtectedRoute>
          } />

          {/* Public: QR Verification */}
          <Route path="/verify/:matricule/:trimestre/:year" element={<VerifyBulletin />} />

          {/* Role-based redirect */}
          <Route path="/" element={<RoleRedirect />} />

          {/* Unauthorized */}
          <Route path="/unauthorized" element={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4 font-sans">
              <div className="glass-card-lg p-8 text-center max-w-sm shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-500 to-orange-500" />
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" />
                  </svg>
                </div>
                <h2 className="text-2xl font-display font-bold text-gray-900 mb-3 uppercase tracking-tight">Accès Non Autorisé</h2>
                <p className="text-gray-500 text-sm mb-8 leading-relaxed">
                  Désolé, vous n&apos;avez pas encore les permissions nécessaires pour cette page.
                  <span className="block mt-2 font-semibold text-primary-600">Patientez quelques secondes et réessayez.</span>
                </p>
                <div className="space-y-3">
                  <button onClick={() => window.location.href = '/'}
                    className="w-full py-4 bg-royal-gradient text-white rounded-2xl font-bold shadow-lg shadow-primary-200 hover:scale-[1.02] active:scale-[0.98] transition-all">
                    Rafraîchir mes droits
                  </button>
                  <button onClick={() => window.location.href = '/login'}
                    className="w-full py-3 text-gray-500 text-sm font-medium hover:text-gray-700 transition-colors">
                    Retour à la connexion
                  </button>
                </div>
              </div>
            </div>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              borderRadius: '12px',
              background: '#1e293b',
              color: '#fff',
              fontSize: '14px',
            },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
