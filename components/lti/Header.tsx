"use client";

import { useState } from "react";
import type { User } from "@/types/lti";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BookOpen, Hash, KeyRound, ShieldCheck } from "lucide-react";

interface HeaderProps {
  readonly user: User | null;
  readonly ltik?: string | null;
  readonly isInstructor?: boolean;
  readonly onTokenSaved?: () => void;
}

export default function Header({
  user,
  ltik,
  isInstructor,
  onTokenSaved,
}: HeaderProps) {
  const initials = user?.name?.charAt(0).toUpperCase() ?? "U";
  const allRoles = [
    ...new Set(
      user?.roles?.map((r) => r.split("#").pop()).filter(Boolean) ?? [],
    ),
  ];

  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = (open: boolean) => {
    setTokenDialogOpen(open);
    if (!open) {
      setToken("");
      setError(null);
    }
  };

  const handleSaveToken = async () => {
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
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setTokenDialogOpen(false);
      setToken("");
      onTokenSaved?.();
    } catch (err: any) {
      setError(err.message || "Failed to save token. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Testlify</h1>

            <div className="flex items-center space-x-6">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Avatar className="h-10 w-10 cursor-pointer border-2 border-brand-200 bg-brand-100 text-brand-700 hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
                    <AvatarFallback className="bg-brand-100 text-brand-700 font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-72 p-0">
                  {/* Profile header */}
                  <div className="flex items-center gap-3 px-4 py-4 bg-muted/40">
                    <Avatar className="h-12 w-12 border-2 border-brand-200 bg-brand-100 text-brand-700 shrink-0">
                      <AvatarFallback className="bg-brand-100 text-brand-700 text-lg font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {user?.name ?? "User"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user?.email ?? "—"}
                      </p>
                    </div>
                  </div>

                  <DropdownMenuSeparator className="my-0" />

                  <div className="px-4 py-3 space-y-3">
                    {/* Roles */}
                    <div className="space-y-1.5">
                      <DropdownMenuLabel className="px-0 py-0 text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Roles
                      </DropdownMenuLabel>
                      <div className="flex flex-wrap gap-1.5">
                        {allRoles.length > 0 ? (
                          allRoles.map((r) => (
                            <Badge
                              key={r}
                              variant="secondary"
                              className="text-xs"
                            >
                              {r}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </div>
                    </div>

                    <DropdownMenuSeparator />

                    {/* Course */}
                    <div className="flex items-start gap-2 text-sm">
                      <BookOpen className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {user?.context?.context?.title ?? "—"}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Hash className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs font-mono text-muted-foreground">
                            {user?.context?.context?.id ?? "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Update Token — instructors only */}
                  {isInstructor && ltik && (
                    <>
                      <DropdownMenuSeparator className="my-0" />
                      <div className="px-2 py-2">
                        <DropdownMenuItem
                          onSelect={() => setTokenDialogOpen(true)}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <KeyRound className="h-4 w-4" />
                          Update Testlify Access Token
                        </DropdownMenuItem>
                      </div>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Update Token Dialog */}
      <Dialog open={tokenDialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Testlify API Token</DialogTitle>
            <DialogDescription>
              Paste your new Testlify API token below. Find it in{" "}
              <strong>Testlify → Settings → Access Token</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <textarea
              rows={4}
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Paste your token here…"
              className="w-full rounded-lg border border-input px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none bg-background"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveToken}
              disabled={saving || !token.trim()}
            >
              {saving ? "Saving…" : "Save Token"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
