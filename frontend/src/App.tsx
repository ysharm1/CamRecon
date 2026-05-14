import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/lib/AuthProvider';
import { queryClient } from '@/lib/queryClient';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Toast } from '@/components/Toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { MainLayout } from '@/layouts/MainLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { useAuth } from '@/lib/auth';
import { DashboardPage } from '@/pages/DashboardPage';
import { PropertiesPage } from '@/pages/PropertiesPage';
import { PropertyDetailPage } from '@/pages/PropertyDetailPage';
import { TenantsPage } from '@/pages/TenantsPage';
import { TenantDetailPage } from '@/pages/TenantDetailPage';
import { DocumentsPage } from '@/pages/DocumentsPage';
import { DocumentDetailPage } from '@/pages/DocumentDetailPage';
import { ReconciliationsPage } from '@/pages/ReconciliationsPage';
import { WhatIfSimulatorPage } from '@/pages/WhatIfSimulatorPage';
import { AbstractionsPage } from '@/pages/AbstractionsPage';
import { SearchPage } from '@/pages/SearchPage';
import { IntegrationsPage } from '@/pages/IntegrationsPage';
import { ImportDataPage } from '@/pages/ImportDataPage';
import { BillingPage } from '@/pages/BillingPage';
import { LoginPage } from '@/pages/LoginPage';
import { LandingPage } from '@/pages/LandingPage';
import { SecurityPage } from '@/pages/SecurityPage';
import { TermsPage } from '@/pages/TermsPage';
import { PrivacyPage } from '@/pages/PrivacyPage';
import { TenantPortalPage } from '@/pages/portal/TenantPortalPage';
import { OnboardingPage } from '@/pages/OnboardingPage';

/**
 * Root route: logged-in users go to the dashboard; everyone else sees the
 * marketing landing page.
 */
function RootRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />;
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public marketing + legal pages */}
              <Route path="/" element={<RootRoute />} />
              <Route path="/security" element={<SecurityPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />

              {/* Auth routes (public) */}
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<LoginPage />} />
              </Route>

              {/*
                Routes below are kept reachable by URL so existing links keep
                working; navigation entry points are feature-flagged elsewhere.
              */}
              <Route path="/portal" element={<TenantPortalPage />} />

              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute>
                    <OnboardingPage />
                  </ProtectedRoute>
                }
              />

              {/* Main app routes (protected) */}
              <Route
                element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/properties" element={<PropertiesPage />} />
                <Route path="/properties/:id" element={<PropertyDetailPage />} />
                <Route path="/tenants" element={<TenantsPage />} />
                <Route path="/tenants/:id" element={<TenantDetailPage />} />
                <Route path="/documents" element={<DocumentsPage />} />
                <Route path="/documents/:id" element={<DocumentDetailPage />} />
                <Route path="/reconciliations" element={<ReconciliationsPage />} />
                {/* What-If Simulator route kept reachable; nav entry is flag-gated. */}
                <Route path="/reconciliations/simulator" element={<WhatIfSimulatorPage />} />
                <Route path="/abstractions" element={<AbstractionsPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/integrations" element={<IntegrationsPage />} />
                <Route path="/import" element={<ImportDataPage />} />
                {/* Billing route kept reachable; nav entry is flag-gated. */}
                <Route path="/billing" element={<BillingPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
          <Toast />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
