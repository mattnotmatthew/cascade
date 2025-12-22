// Authentication modal for sign in/sign up

import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import "./AuthModal.css";

type AuthMode = "signin" | "signup";

export function AuthModal() {
  const { showAuthModal, closeAuthModal, signIn, signUp, signInGoogle } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!showAuthModal) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const result = mode === "signin"
      ? await signIn(email, password)
      : await signUp(email, password);

    setIsLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      // Success - modal will close automatically via context
      setEmail("");
      setPassword("");
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    const result = await signInGoogle();
    if (result.error) {
      setError(result.error);
    }
    // Google OAuth redirects, so no need to close modal
  };

  const switchMode = () => {
    setMode(mode === "signin" ? "signup" : "signin");
    setError(null);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeAuthModal();
    }
  };

  return (
    <div className="auth-overlay" onClick={handleBackdropClick}>
      <div className="auth-modal">
        <button className="auth-close" onClick={closeAuthModal} aria-label="Close">
          ×
        </button>

        <h2>{mode === "signin" ? "Sign In" : "Create Account"}</h2>

        <p className="auth-subtitle">
          {mode === "signin"
            ? "Sign in to save your scores and compete on the leaderboard"
            : "Create an account to track your progress"}
        </p>

        {/* Google Sign In */}
        <button
          type="button"
          className="google-button"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
        >
          <svg className="google-icon" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>

        <div className="auth-divider">
          <span>or</span>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              disabled={isLoading}
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="submit-button" disabled={isLoading}>
            {isLoading ? "..." : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <p className="auth-switch">
          {mode === "signin" ? (
            <>
              Don't have an account?{" "}
              <button type="button" onClick={switchMode}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button type="button" onClick={switchMode}>
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
