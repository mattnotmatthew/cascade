// Modal for setting display name after email confirmation

import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import "./DisplayNameModal.css";

export function DisplayNameModal() {
  const { showDisplayNameModal, closeDisplayNameModal, setDisplayName, user } = useAuth();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!showDisplayNameModal) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }
    if (trimmedName.length > 30) {
      setError("Name must be 30 characters or less");
      return;
    }

    setIsLoading(true);
    const result = await setDisplayName(trimmedName);
    setIsLoading(false);

    if (result.error) {
      setError(result.error);
    }
    // Success will close the modal via context
  };

  const handleSkip = () => {
    closeDisplayNameModal();
  };

  return (
    <div className="display-name-overlay">
      <div className="display-name-modal">
        <h2>Welcome to CASCADE!</h2>
        <p className="display-name-subtitle">
          Choose a display name for the leaderboards
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="displayName">Display Name</label>
            <input
              id="displayName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={user?.email?.split("@")[0] || "Your name"}
              autoFocus
              maxLength={30}
              disabled={isLoading}
            />
          </div>

          {error && <div className="display-name-error">{error}</div>}

          <button type="submit" className="submit-button" disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Name"}
          </button>
        </form>

        <button type="button" className="skip-button" onClick={handleSkip}>
          Skip for now
        </button>
      </div>
    </div>
  );
}
