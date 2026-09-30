import { AuthProvider, useAuth } from "./auth/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";

function Screen() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <DashboardPage /> : <LoginPage />;
}

export function App() {
  return (
    <AuthProvider>
      <Screen />
    </AuthProvider>
  );
}
