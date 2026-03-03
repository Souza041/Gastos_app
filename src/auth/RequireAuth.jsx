import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 24 }}>Carregando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}