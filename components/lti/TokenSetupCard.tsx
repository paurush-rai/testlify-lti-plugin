"use client";

import { useState } from "react";

interface TokenSetupCardProps {
  ltik: string;
  onTokenSaved: () => void;
  isInstructor: boolean;
}

export default function TokenSetupCard({
  ltik,
  onTokenSaved,
  isInstructor,
}: TokenSetupCardProps) {
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const trimmed = token.trim();
    if (!trimmed) {
      setError("Please paste your Testlify API token.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ltik}`,
        },
        body: JSON.stringify({ token: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      onTokenSaved();
    } catch (err: any) {
      setError(err.message || "Failed to save token. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!isInstructor) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="h-7 w-7 text-brand-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Setup Required
          </h2>
          <p className="text-gray-500 text-sm">
            This tool has not been configured yet. Please ask your instructor or
            administrator to connect the Testlify workspace.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-16">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 max-w-lg w-full">
        {/* Icon */}
        <div className="w-14 h-14 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg
            className="h-7 w-7 text-brand-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
            />
          </svg>
        </div>

        <h2 className="text-xl font-semibold text-gray-900 text-center mb-1">
          Connect your Testlify workspace
        </h2>
        <p className="text-sm text-gray-500 text-center mb-6">
          Paste your Testlify Access Token below. You only need to do this once —
          it will be remembered for all future sessions on this platform.
        </p>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="testlify-token"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Testlify API Token
            </label>
            <textarea
              id="testlify-token"
              rows={4}
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Paste your token here…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 flex items-center gap-1.5">
              <svg
                className="h-4 w-4 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {error}
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !token.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Saving…
              </>
            ) : (
              "Save Token"
            )}
          </button>
        </div>

        <p className="mt-4 text-xs text-gray-400 text-center">
          Find your token in{" "}
          <strong className="text-gray-500">
            Testlify → Settings → Access Token
          </strong>
          .
        </p>
      </div>
    </div>
  );
}
