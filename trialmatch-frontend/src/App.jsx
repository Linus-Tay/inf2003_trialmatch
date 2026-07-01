import { Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AppLayout from "./layouts/AppLayout.jsx";
import AnalyticsPage from "./pages/AnalyticsPage.jsx";
import CriteriaAnalyticsPage from "./pages/CriteriaAnalyticsPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import DatabaseDemoPage from "./pages/DatabaseDemoPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import PatientMatchPage from "./pages/PatientMatchPage.jsx";
import SavedTrialsPage from "./pages/SavedTrialsPage.jsx";
import SignupPage from "./pages/SignupPage.jsx";
import TrialDetailPage from "./pages/TrialDetailPage.jsx";
import TrialManagementPage from "./pages/TrialManagementPage.jsx";
import TrialsPage from "./pages/TrialsPage.jsx";
import AdminRoute from "./components/AdminRoute.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/trials" element={<TrialsPage />} />
        <Route path="/trials/:trialId" element={<TrialDetailPage />} />
        <Route path="/patients" element={<PatientMatchPage />} />
        <Route path="/saved" element={<SavedTrialsPage />} />
        <Route
          path="/management"
          element={
            <AdminRoute>
              <TrialManagementPage />
            </AdminRoute>
          }
        />

        <Route
          path="/analytics"
          element={
            <AdminRoute>
              <AnalyticsPage />
            </AdminRoute>
          }
        />

        <Route
          path="/criteria-analytics"
          element={
            <AdminRoute>
              <CriteriaAnalyticsPage />
            </AdminRoute>
          }
        />

        <Route
          path="/database-demo"
          element={
            <AdminRoute>
              <DatabaseDemoPage />
            </AdminRoute>
          }
        />
      </Route>
    </Routes>
  );
}
