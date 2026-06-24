import LoginLanding from "./components/LoginLanding";
import React, { Suspense } from "react";
import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./contexts/useAuth";
import { SidebarProvider } from "./contexts/SidebarContext";
import { MonthYearProvider } from "./contexts/MonthYearContext";
import Layout from "./components/Layout";
import api from "./libs/api";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

// Lazy load pages for code splitting
const Settings = React.lazy(() => import("./pages/Settings"));
const Stats = React.lazy(() => import("./pages/Stats"));
const AdminStats = React.lazy(() => import("./pages/AdminStats"));
const SnapshotGenerator = React.lazy(() => import("./pages/SnapshotGenerator"));
const ReportEditor = React.lazy(() => import("./pages/ReportEditor"));

const AppRoutes: React.FC = () => {
  const { user, loading } = useAuth();
  const [firstTable, setFirstTable] = React.useState<string | null>(null);

  // Fetch first available table for all non-admin users
  React.useEffect(() => {
    const fetchFirstTable = async () => {
      const shouldFetchTable = user?.role === 'faculty' ||
        user?.role === 'hod' ||
        user?.role === 'reports-incharge';

      if (shouldFetchTable) {
        try {
          const response = await api.get('/sections/sidebar');
          if (response.data.sections && response.data.sections.length > 0) {
            setFirstTable(response.data.sections[0].section_key);
          }
        } catch (error) {
          console.error('Failed to fetch sections:', error);
        }
      }
    };
    fetchFirstTable();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginLanding />} />
      </Routes>
    );
  }

  // Determine default route based on user role
  const getDefaultRoute = () => {
    if (user.role === 'hod' || user.role === 'reports-incharge') {
      // Default to first table for all HOD/reports-incharge
      return firstTable ? `/section/${firstTable}` : '/settings';
    }
    if (user.role === 'faculty') return '/editor';
    if (user.role === 'admin') return '/admin/stats';
    return '/settings'; // fallback
  };

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    }>
      <Routes>
        {/* Main app with layout (includes sidebar) */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to={getDefaultRoute()} replace />} />
          <Route path="editor" element={<ReportEditor />} />
          <Route path="section/:sectionKey" element={<ReportEditor />} />
          <Route path="settings" element={<Settings />} />
          <Route path="stats" element={<Stats />} />

          {/* Admin Routes */}
          <Route path="admin/stats" element={<AdminStats />} />
          <Route path="admin/snapshot" element={<SnapshotGenerator />} />

        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <SidebarProvider>
          <MonthYearProvider>
            <AppRoutes />
          </MonthYearProvider>
        </SidebarProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;
