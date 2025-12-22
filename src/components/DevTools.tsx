// Developer tools panel for testing (only visible in dev mode)

import { useState, useEffect } from "react";
import {
  isDevMode,
  getDevToolsStatus,
  setDevDateOverride,
  clearDevDateOverride,
  deleteDevAttempt,
  type DevToolsStatus,
} from "../services/devTools";
import "./DevTools.css";

export function DevTools() {
  const [status, setStatus] = useState<DevToolsStatus | null>(null);
  const [dateInput, setDateInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Don't render anything in production
  if (!isDevMode()) return null;

  // Load status on mount and when panel opens
  useEffect(() => {
    if (isOpen) {
      const currentStatus = getDevToolsStatus();
      setStatus(currentStatus);
      setDateInput(currentStatus.dateOverride || "");
    }
  }, [isOpen]);

  const handleSetDate = () => {
    if (dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
      setDevDateOverride(dateInput);
      setStatus(getDevToolsStatus());
      setMessage("Date override set. Refresh the page to load the new puzzle.");
    } else {
      setMessage("Invalid date format. Use YYYY-MM-DD");
    }
  };

  const handleClearDate = () => {
    clearDevDateOverride();
    setDateInput("");
    setStatus(getDevToolsStatus());
    setMessage("Date override cleared. Refresh to use today's date.");
  };

  const handleDeleteAttempt = async () => {
    const result = await deleteDevAttempt();
    if (result.success) {
      setMessage("Today's attempt deleted. You can play again!");
    } else {
      setMessage(`Error: ${result.error}`);
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        className="dev-tools-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title="Developer Tools"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="dev-tools-panel">
          <div className="dev-tools-header">
            <h3>Dev Tools</h3>
            <button className="close-button" onClick={() => setIsOpen(false)}>
              ×
            </button>
          </div>

          <div className="dev-tools-content">
            {/* Status */}
            <div className="dev-section">
              <h4>Status</h4>
              <div className="status-grid">
                <span className="status-label">Effective Date:</span>
                <span className="status-value">{status?.effectiveDate}</span>

                <span className="status-label">Date Override:</span>
                <span className="status-value">
                  {status?.dateOverride || "(none)"}
                </span>

                <span className="status-label">Supabase:</span>
                <span className={`status-value ${status?.supabaseEnabled ? "online" : "offline"}`}>
                  {status?.supabaseEnabled ? "Connected" : "Offline"}
                </span>
              </div>
            </div>

            {/* Date Override */}
            <div className="dev-section">
              <h4>Test Different Date</h4>
              <p className="section-hint">
                Play a puzzle from a different date without waiting.
              </p>
              <div className="date-controls">
                <input
                  type="date"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  className="date-input"
                />
                <button onClick={handleSetDate} className="action-button">
                  Set
                </button>
                {status?.dateOverride && (
                  <button onClick={handleClearDate} className="action-button secondary">
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Reset Attempt */}
            <div className="dev-section">
              <h4>Reset Today's Attempt</h4>
              <p className="section-hint">
                Delete your attempt for the current date to test again.
              </p>
              <button onClick={handleDeleteAttempt} className="action-button danger">
                Delete Today's Attempt
              </button>
            </div>

            {/* Refresh */}
            <div className="dev-section">
              <button onClick={handleRefresh} className="action-button full-width">
                Refresh Page
              </button>
            </div>

            {/* Message */}
            {message && (
              <div className="dev-message">
                {message}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
