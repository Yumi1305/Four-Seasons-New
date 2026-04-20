import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { loading, isAdmin, session } = useAuth();

  if (loading) {
    return (
      <main className="page-content">
        <div className="container">
          <p>Loading…</p>
        </div>
      </main>
    );
  }

  if (!session || !isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}

