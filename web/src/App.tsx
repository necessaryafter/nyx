import { Routes, Route, Navigate } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import { AuthPage } from "./pages/AuthPage";
import { DashboardLayout } from "./components/dashboard/DashboardLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { TemplatesPage } from "./pages/TemplatesPage";
import { AssetsPage } from "./pages/AssetsPage";
import { JobsPage } from "./pages/JobsPage";
import { CreditsPage } from "./pages/CreditsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TemplateEditorPage } from "./pages/TemplateEditorPage";
import { RenderPage } from "./pages/RenderPage";
import { JobWizardPage } from "./pages/JobWizardPage";
import { SchedulersPage } from "./pages/SchedulersPage";
import { SchedulerFormPage } from "./pages/SchedulerFormPage";
import { SchedulerDetailPage } from "./pages/SchedulerDetailPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<AuthPage initialMode="login" />} />
      <Route path="/register" element={<AuthPage initialMode="register" />} />

      {/* Full screen pages outside dashboard layout */}
      <Route path="/templates/new" element={<TemplateEditorPage />} />
      <Route path="/templates/:id/edit" element={<TemplateEditorPage />} />
      <Route path="/render/:templateId" element={<RenderPage />} />
      <Route path="/jobs/new" element={<JobWizardPage />} />
      <Route path="/jobs/:id/edit" element={<JobWizardPage />} />
      <Route path="/schedulers/new" element={<SchedulerFormPage />} />
      <Route path="/schedulers/:id/edit" element={<SchedulerFormPage />} />

      {/* Protected routes under sidebar layout */}
      <Route element={<DashboardLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/schedulers" element={<SchedulersPage />} />
        <Route path="/schedulers/:id" element={<SchedulerDetailPage />} />
        <Route path="/credits" element={<CreditsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
