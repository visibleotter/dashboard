import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Login } from "@/components/Login";
import { AppLayout } from "@/components/AppLayout";
import { DashboardPage } from "@/pages/DashboardPage";
import { CasesListPage } from "@/pages/CasesListPage";
import { CaseFormPage } from "@/pages/CaseFormPage";
import { TasksPage } from "@/pages/TasksPage";
import { CalendarPage } from "@/pages/CalendarPage";
import { KnowledgeBasePage } from "@/pages/KnowledgeBasePage";

/*
  Top-level: auth gate, then the router (Phase 3).
  - loading   → spinner
  - no user   → Login (no business data rendered)
  - signed in → routed app inside AppLayout
*/
function App() {
  const { loading, user } = useAuth();
  const { t } = useI18n();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="cases" element={<CasesListPage />} />
          <Route path="cases/new" element={<CaseFormPage mode="create" />} />
          <Route path="cases/:id" element={<CaseFormPage mode="edit" />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="kb" element={<KnowledgeBasePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
