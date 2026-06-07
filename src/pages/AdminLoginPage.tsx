import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const COOLDOWN_MS = 3000;

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { signIn, loading, session, isAdmin } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  const disabled = loading || submitting || cooldown;

  if (!loading && session && isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    setError("");
    setSubmitting(true);

    try {
      await signIn(email.trim(), password);
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setCooldown(true);
      window.setTimeout(() => setCooldown(false), COOLDOWN_MS);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="page-content admin-page">
      <div className="container">
        <h1 className="page-title">Owner / Admin Login</h1>
        <p className="admin-login-desc">Enter your email + password to access admin tools.</p>

        <form onSubmit={onSubmit} className="admin-login-form">
          <label className="order-form-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@your-school.com"
              autoComplete="email"
              required
            />
          </label>

          <label className="order-form-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin password"
              autoComplete="current-password"
              required
            />
          </label>

          {error && <p className="admin-login-error">{error}</p>}

          <button type="submit" className="btn-primary" disabled={disabled}>
            {submitting ? "Signing in…" : cooldown ? "Please wait…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}

