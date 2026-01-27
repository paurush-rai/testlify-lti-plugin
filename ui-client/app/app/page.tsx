"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function LtiApp() {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const ltik = searchParams.get("ltik");

  useEffect(() => {
    if (!ltik) {
      console.log("No LTIK found in URL");
    }

    fetch("/api/me", {
      headers: {
        "Content-Type": "application/json",
        Authorization: ltik ? `Bearer ${ltik}` : "",
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Unauthorized or session expired");
        }
        return res.json();
      })
      .then((data) => {
        setUser(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load LTI session. Please relaunch from LMS.");
        setLoading(false);
      });
  }, [ltik]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-card p-8 text-center border-red-500/30">
          <h2 className="text-2xl font-bold text-red-400 mb-4">
            Connection Error
          </h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Welcome, {user?.name || "User"}</h1>
        <p className="text-gray-400">
          Role: {user?.roles?.join(", ") || "Student"}
        </p>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4 text-purple-300">
            Course Context
          </h2>
          <div className="space-y-2">
            <pre>{JSON.stringify(user, null, 2)}</pre>
            <p>
              <span className="text-gray-400">Course:</span>{" "}
              {user?.context?.context?.title || "Unknown Course"}
            </p>
            <p>
              <span className="text-gray-400">ID:</span> {user?.context?.id}
            </p>
          </div>
        </div>

        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4 text-blue-300">
            Tool Status
          </h2>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-green-500"></div>
            <span>LTI 1.3 Active</span>
          </div>
          <p className="mt-4 text-sm text-gray-400">
            Session valid. Tokens exchanged successfully.
          </p>
        </div>
      </main>
    </div>
  );
}
