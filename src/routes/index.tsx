import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation
} from "react-router-dom";
import React, { lazy, Suspense, useEffect } from "react";
import { App } from "@capacitor/app";
import { useAuth } from "../hooks/useAuth";

// Lazy load page components
const LoginScreen = lazy(() => import("../views/pages/LoginScreen"));
const GroupSelection = lazy(() => import("../views/pages/GroupSelection"));
const Dashboard = lazy(() => import("../views/pages/Dashboard"));
const GroupSettings = lazy(() => import("../views/pages/GroupSettings"));
const YearSelection = lazy(() => import("../views/pages/YearSelection"));
const IponIponOverview = lazy(() => import("../views/pages/IponIponOverview"));
const AddPerson = lazy(() => import("../views/pages/AddPerson"));
const PersonSavingsDetail = lazy(() => import("../views/pages/PersonSavingsDetail"));
const HiramOverview = lazy(() => import("../views/pages/HiramOverview"));
const HiramDetail = lazy(() => import("../views/pages/HiramDetail"));
const HiramPayment = lazy(() => import("../views/pages/HiramPayment"));
const PendingApprovals = lazy(() => import("../views/pages/PendingApprovals"));
const QuickBalance = lazy(() => import("../views/pages/QuickBalance"));
const ResetPassword = lazy(() => import("../views/pages/ResetPassword"));
const PersonalLoansTracker = lazy(() => import("../views/pages/PersonalLoansTracker"));

// Elegant loader using CSS custom variables matching user theme
const PageLoading = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
    <div className="relative flex items-center justify-center">
      <div className="w-16 h-16 border-4 border-[var(--secondary)] rounded-full animate-spin border-t-[var(--primary)]"></div>
      <div className="absolute w-8 h-8 bg-[var(--primary)] rounded-full animate-pulse opacity-75"></div>
    </div>
    <p className="mt-4 text-sm font-medium tracking-wide text-[var(--muted-foreground)] animate-pulse">
      Loading page...
    </p>
  </div>
);

// Hardware back button handler for Android/Capacitor devices
function BackButtonHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleBackButton = async () => {
      const currentPath = location.pathname;
      const rootPaths = ["/login", "/group-selection", "/dashboard", "/"];
      
      // If we are on one of the root screens or have no page history, exit the app
      if (rootPaths.includes(currentPath) || window.history.state?.idx === 0) {
        await App.exitApp();
      } else {
        navigate(-1);
      }
    };

    const listener = App.addListener("backButton", handleBackButton);

    return () => {
      listener.then(l => l.remove());
    };
  }, [location, navigate]);

  return null;
}

// Deep linking handler to process external URL scheme launches
function DeepLinkHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleUrlOpen = (event: { url: string }) => {
      console.log('App opened with URL:', event.url);
      
      try {
        const rawUrl = event.url;
        let path = '';
        let hash = '';

        if (rawUrl.startsWith('iponipon://')) {
          const parts = rawUrl.replace('iponipon://', '').split('#');
          path = parts[0];
          hash = parts[1] ? '#' + parts[1] : '';
        } else {
          const parsedUrl = new URL(rawUrl);
          path = parsedUrl.pathname;
          hash = parsedUrl.hash;
        }

        if (path === 'reset-password' || path === '/reset-password') {
          if (hash) {
            window.location.hash = hash;
          }
          navigate('/reset-password', { replace: true });
        }
      } catch (err) {
        console.error('Error handling deep link URL:', err);
      }
    };

    const listener = App.addListener('appUrlOpen', handleUrlOpen);

    return () => {
      listener.then(l => l.remove());
    };
  }, [navigate]);

  return null;
}

export default function AppRoutes() {
  const { isAuthenticated } = useAuth();
  const selectedGroupId = localStorage.getItem('ipon_selected_group_id');

  return (
    <BrowserRouter>
      <BackButtonHandler />
      <DeepLinkHandler />
      <Suspense fallback={<PageLoading />}>
        <Routes>
          {/* Login route */}
          <Route 
            path="/login" 
            element={
              isAuthenticated ? (
                <Navigate to={selectedGroupId ? "/dashboard" : "/group-selection"} replace />
              ) : (
                <LoginScreen />
              )
            } 
          />
          <Route path="/quick-balance" element={<QuickBalance />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          {/* Group Selection route */}
          <Route path="/group-selection" element={<GroupSelection />} />
          <Route path="/personal-loans" element={<PersonalLoansTracker />} />
          
          {/* Dashboard route */}
          <Route path="/dashboard" element={<Dashboard />} />
          
          {/* Pending Approvals route */}
          <Route path="/pending-approvals" element={<PendingApprovals />} />
          
          {/* Group Settings route */}
          <Route path="/group-settings" element={<GroupSettings />} />
          
          {/* Year Selection route */}
          <Route path="/year-selection" element={<YearSelection />} />
          
          {/* Ipon-Ipon routes */}
          <Route path="/ipon-ipon" element={<IponIponOverview />} />
          <Route path="/ipon-ipon/add" element={<AddPerson />} />
          <Route path="/ipon-ipon/:personId" element={<PersonSavingsDetail />} />
          
          {/* Hiram routes */}
          <Route path="/hiram" element={<HiramOverview />} />
          <Route path="/hiram/:borrowerId/pay/:loanId" element={<HiramPayment />} />
          <Route path="/hiram/:borrowerId" element={<HiramDetail />} />
          
          {/* Default route - redirect based on auth */}
          <Route 
            path="/" 
            element={
              isAuthenticated ? (
                <Navigate to={selectedGroupId ? "/dashboard" : "/group-selection"} replace />
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          
          {/* Catch all - redirect based on auth */}
          <Route 
            path="/*" 
            element={
              isAuthenticated ? (
                <Navigate to={selectedGroupId ? "/dashboard" : "/group-selection"} replace />
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
