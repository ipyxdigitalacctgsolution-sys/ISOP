import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import AuthPage from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Profile from "@/pages/Profile";
import PlaceholderPage from "@/pages/Placeholder";
import EducationalLevelsPage from "@/pages/EducationalLevels";
import SchoolFeesPage from "@/pages/SchoolFees";
import EnrolleesPage from "@/pages/Enrollees";
import CollectionPage from "@/pages/Collection";
import StaffTeachersPage from "@/pages/StaffTeachers";
import AdvisoryMappingPage from "@/pages/AdvisoryMapping";
import AdminUsersPage from "@/pages/AdminUsers";
import AdminSubscriptionsPage from "@/pages/AdminSubscriptions";
import UpgradePlanPage from "@/pages/UpgradePlan";
import AccountsReceivablesPage from "@/pages/AccountsReceivables";
import { DashboardLayout } from "@/components/ui/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/auth" component={AuthPage} />
      
      <Route path="/dashboard" component={() => (
        <DashboardLayout>
          <ProtectedRoute path="/dashboard" component={Dashboard} />
        </DashboardLayout>
      )} />

      <Route path="/dashboard/profile" component={() => (
        <DashboardLayout>
          <ProtectedRoute path="/dashboard/profile" component={Profile} />
        </DashboardLayout>
      )} />

      <Route path="/dashboard/upgrade" component={() => (
        <DashboardLayout>
          <ProtectedRoute path="/dashboard/upgrade" component={UpgradePlanPage} />
        </DashboardLayout>
      )} />

      <Route path="/dashboard/admin/users" component={() => (
        <DashboardLayout>
          <ProtectedRoute path="/dashboard/admin/users" component={AdminUsersPage} />
        </DashboardLayout>
      )} />

      <Route path="/dashboard/admin/subscriptions" component={() => (
        <DashboardLayout>
          <ProtectedRoute path="/dashboard/admin/subscriptions" component={AdminSubscriptionsPage} />
        </DashboardLayout>
      )} />

      <Route path="/dashboard/academic/levels" component={() => (
        <DashboardLayout>
          <ProtectedRoute path="/dashboard/academic/levels" component={EducationalLevelsPage} />
        </DashboardLayout>
      )} />

      <Route path="/dashboard/academic/fees" component={() => (
        <DashboardLayout>
          <ProtectedRoute path="/dashboard/academic/fees" component={SchoolFeesPage} />
        </DashboardLayout>
      )} />

      <Route path="/dashboard/academic/enrollees" component={() => (
        <DashboardLayout>
          <ProtectedRoute path="/dashboard/academic/enrollees" component={EnrolleesPage} />
        </DashboardLayout>
      )} />

      <Route path="/dashboard/academic/teachers" component={() => (
        <DashboardLayout>
          <ProtectedRoute path="/dashboard/academic/teachers" component={StaffTeachersPage} />
        </DashboardLayout>
      )} />

      <Route path="/dashboard/academic/advisory" component={() => (
        <DashboardLayout>
          <ProtectedRoute path="/dashboard/academic/advisory" component={AdvisoryMappingPage} />
        </DashboardLayout>
      )} />

      <Route path="/dashboard/academic/:page" component={({ params }) => (
        <DashboardLayout>
          <ProtectedRoute 
            path={`/dashboard/academic/${params.page}`} 
            component={() => <PlaceholderPage title={`Academic: ${params.page.replace(/-/g, ' ').toUpperCase()}`} />} 
          />
        </DashboardLayout>
      )} />

      <Route path="/dashboard/finance/collection" component={() => (
        <DashboardLayout>
          <ProtectedRoute path="/dashboard/finance/collection" component={CollectionPage} />
        </DashboardLayout>
      )} />

      <Route path="/dashboard/finance/receivables" component={() => (
        <DashboardLayout>
          <ProtectedRoute path="/dashboard/finance/receivables" component={AccountsReceivablesPage} />
        </DashboardLayout>
      )} />

      <Route path="/dashboard/finance/:page" component={({ params }) => (
        <DashboardLayout>
          <ProtectedRoute 
            path={`/dashboard/finance/${params.page}`} 
            component={() => <PlaceholderPage title={`Finance: ${params.page.replace(/-/g, ' ').toUpperCase()}`} />} 
          />
        </DashboardLayout>
      )} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
