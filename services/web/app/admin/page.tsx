"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/api";
import { WalletProvider } from "@/lib/wallet-context";
import { PopHeader } from "@/components/pop-header";
import { GradientMesh } from "@/components/gradient-mesh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";

interface AdminAnchor {
  id: string;
  name: string;
  domain: string;
  network?: "mainnet" | "testnet";
  country: string;
  currency: string;
  type: "on-ramp" | "off-ramp";
  active: boolean;
  capabilities: {
    sep24: boolean;
    sep6: boolean;
    sep31: boolean;
    sep10: boolean;
    operational: boolean;
    lastCheckedAt?: string;
    diagnostics?: string[];
  };
}

interface AdminUser {
  email: string;
}

function AdminPageContent() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [sessionToken, setSessionToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [anchors, setAnchors] = useState<AdminAnchor[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [networkFilter, setNetworkFilter] = useState<"all" | "mainnet" | "testnet">(
    "all"
  );
  const [statusFilter, setStatusFilter] = useState<
    "all" | "operational" | "not-ready" | "active" | "disabled"
  >("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "on-ramp" | "off-ramp">(
    "all"
  );
  const [countryFilter, setCountryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [domain, setDomain] = useState("");
  const [countries, setCountries] = useState("");
  const [currencies, setCurrencies] = useState("");

  useEffect(() => {
    const stored = sessionStorage.getItem("pop_admin_session") ?? "";
    if (stored) setSessionToken(stored);
  }, []);

  const authHeaders = useCallback(
    (headers?: HeadersInit): HeadersInit => ({
      "Content-Type": "application/json",
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      ...(headers ?? {}),
    }),
    [sessionToken]
  );

  const adminFetch = useCallback(
    async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
      const response = await fetch(apiUrl(path), {
        ...init,
        credentials: "include",
        headers: authHeaders(init.headers),
      });
      const payload = (await response.json().catch(() => ({}))) as T & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || `Admin API failed (${response.status})`);
      }
      return payload;
    },
    [authHeaders]
  );

  const loadAnchors = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await adminFetch<{ anchors: AdminAnchor[] }>(
        "/api/admin/anchors"
      );
      setAnchors(payload.anchors ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load anchors");
    } finally {
      setLoading(false);
    }
  }, [adminFetch, user]);

  useEffect(() => {
    let active = true;
    async function checkSession() {
      setCheckingSession(true);
      try {
        const payload = await adminFetch<{
          authenticated: boolean;
          user: AdminUser | null;
        }>("/api/admin/session");
        if (!active) return;
        if (payload.authenticated && payload.user) {
          setUser(payload.user);
        } else {
          setUser(null);
          setAnchors([]);
        }
      } catch {
        if (active) {
          setUser(null);
          setAnchors([]);
        }
      } finally {
        if (active) setCheckingSession(false);
      }
    }
    void checkSession();
    return () => {
      active = false;
    };
  }, [adminFetch]);

  useEffect(() => {
    void loadAnchors();
  }, [loadAnchors]);

  const login = useCallback(async () => {
    setError(null);
    setMessage(null);
    setWorkingId("login");
    try {
      const payload = await adminFetch<{
        status: string;
        token: string;
        user: AdminUser;
      }>("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      sessionStorage.setItem("pop_admin_session", payload.token);
      setSessionToken(payload.token);
      setUser(payload.user);
      setPassword("");
      setMessage("Signed in.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setWorkingId(null);
    }
  }, [adminFetch, email, password]);

  const logout = useCallback(async () => {
    setWorkingId("logout");
    try {
      await adminFetch("/api/admin/logout", { method: "POST" });
    } catch {
      // Local session cleanup still happens.
    } finally {
      sessionStorage.removeItem("pop_admin_session");
      setSessionToken("");
      setUser(null);
      setAnchors([]);
      setWorkingId(null);
    }
  }, [adminFetch]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return anchors.filter((anchor) => {
      const network = anchor.network === "testnet" ? "testnet" : "mainnet";
      if (networkFilter !== "all" && network !== networkFilter) return false;
      if (typeFilter !== "all" && anchor.type !== typeFilter) return false;
      if (countryFilter !== "all" && anchor.country !== countryFilter) return false;
      if (statusFilter === "operational" && !anchor.capabilities.operational) {
        return false;
      }
      if (statusFilter === "not-ready" && anchor.capabilities.operational) {
        return false;
      }
      if (statusFilter === "active" && !anchor.active) return false;
      if (statusFilter === "disabled" && anchor.active) return false;
      if (!q) return true;
      return [
        anchor.name,
        anchor.domain,
        anchor.country,
        anchor.currency,
        anchor.type,
        anchor.network ?? "",
        anchor.id,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [anchors, countryFilter, networkFilter, query, statusFilter, typeFilter]);

  useEffect(() => {
    setPage(1);
  }, [countryFilter, networkFilter, query, statusFilter, typeFilter]);

  const pageSize = 15;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, filtered.length);
  const visibleAnchors = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const networkCounts = useMemo(() => {
    return anchors.reduce(
      (acc, anchor) => {
        const network = anchor.network === "testnet" ? "testnet" : "mainnet";
        acc[network] += 1;
        return acc;
      },
      { mainnet: 0, testnet: 0 }
    );
  }, [anchors]);

  const countryOptions = useMemo(() => {
    return [...new Set(anchors.map((anchor) => anchor.country))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [anchors]);

  const runAction = useCallback(
    async (body: Record<string, unknown>, id?: string) => {
      setWorkingId(id ?? "global");
      setError(null);
      setMessage(null);
      try {
        const payload = await adminFetch<{ status: string; written?: number }>(
          "/api/admin/anchors",
          {
            method: "POST",
            body: JSON.stringify(body),
          }
        );
        setMessage(
          payload.written !== undefined
            ? `Done. Rows written: ${payload.written}`
            : "Done."
        );
        await loadAnchors();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      } finally {
        setWorkingId(null);
      }
    },
    [adminFetch, loadAnchors]
  );

  const discoverAndAdd = useCallback(async () => {
    if (!domain.trim()) {
      setError("Domain is required.");
      return;
    }
    await runAction({
      action: "discover_domain",
      domain,
      countries,
      currencies,
      apply: true,
      active: true,
    });
  }, [countries, currencies, domain, runAction]);

  const refreshAll = useCallback(async () => {
    await runAction({ action: "refresh_all", limit: 100 });
  }, [runAction]);

  if (checkingSession) {
    return (
      <div className="relative min-h-screen bg-background">
        <GradientMesh />
        <PopHeader variant="app" />
        <main className="relative z-10 mx-auto flex min-h-[70vh] max-w-md items-center justify-center px-4 pt-24">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative min-h-screen bg-background">
        <GradientMesh />
        <PopHeader variant="app" />
        <main className="relative z-10 mx-auto flex min-h-[70vh] max-w-md items-center px-4 pt-24">
          <div className="w-full rounded-xl border border-border bg-card p-5">
            <h1 className="text-2xl font-bold text-foreground">Admin Login</h1>
            <div className="mt-5 space-y-3">
              <Input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                autoComplete="email"
              />
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  autoComplete="current-password"
                  className="pr-10"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void login();
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <Button
                onClick={login}
                disabled={workingId === "login" || !email || !password}
                className="w-full"
              >
                {workingId === "login" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Sign in
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background">
      <GradientMesh />
      <PopHeader variant="app" />
      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-24 sm:px-6">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
              Anchor Admin
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Signed in as {user.email}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline">Mainnet {networkCounts.mainnet}</Badge>
              <Badge variant="outline">Testnet {networkCounts.testnet}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={refreshAll}
              disabled={workingId === "global"}
              className="rounded-xl"
            >
              {workingId === "global" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh first 100
            </Button>
            <Button onClick={logout} variant="outline" disabled={workingId === "logout"}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>

        <div className="mb-5 grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search anchors"
              className="pl-9"
            />
          </div>
          <Button onClick={loadAnchors} disabled={loading} variant="outline">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Load
          </Button>
        </div>

        <div className="mb-5 grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          <Select
            value={networkFilter}
            onValueChange={(value) =>
              setNetworkFilter(value as "all" | "mainnet" | "testnet")
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="testnet">Testnet</SelectItem>
              <SelectItem value="mainnet">Mainnet</SelectItem>
              <SelectItem value="all">All networks</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(
                value as "all" | "operational" | "not-ready" | "active" | "disabled"
              )
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="operational">Operational</SelectItem>
              <SelectItem value="not-ready">Not ready</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={typeFilter}
            onValueChange={(value) =>
              setTypeFilter(value as "all" | "on-ramp" | "off-ramp")
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="on-ramp">On-ramp</SelectItem>
              <SelectItem value="off-ramp">Off-ramp</SelectItem>
            </SelectContent>
          </Select>
          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All countries</SelectItem>
              {countryOptions.map((country) => (
                <SelectItem key={country} value={country}>
                  {country}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setNetworkFilter("all");
              setStatusFilter("all");
              setTypeFilter("all");
              setCountryFilter("all");
              setQuery("");
            }}
          >
            Reset
          </Button>
        </div>

        <div className="mb-5 grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-[1fr_1fr_1fr_auto]">
          <Input
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            placeholder="stellar.moneygram.com"
          />
          <Input
            value={countries}
            onChange={(event) => setCountries(event.target.value)}
            placeholder="Countries, e.g. US,CO"
          />
          <Input
            value={currencies}
            onChange={(event) => setCurrencies(event.target.value)}
            placeholder="Assets, optional"
          />
          <Button onClick={discoverAndAdd} disabled={workingId === "global"}>
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>

        {(message || error) && (
          <div
            className={cn(
              "mb-5 rounded-xl border px-4 py-3 text-sm",
              error
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-success/30 bg-success/10 text-success"
            )}
          >
            {error || message}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3 text-xs text-muted-foreground">
            <span>
              Showing {filtered.length} of {anchors.length}
            </span>
            <span>
              {networkFilter === "all" ? "All networks" : networkFilter}
            </span>
          </div>
          <div className="grid grid-cols-[1.5fr_0.75fr_0.8fr_0.8fr_1fr_1.2fr] gap-3 border-b border-border bg-muted/20 px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <span>Anchor</span>
            <span>Network</span>
            <span>Market</span>
            <span>Status</span>
            <span>SEP</span>
            <span className="text-right">Actions</span>
          </div>
          {visibleAnchors.map((anchor) => (
            <div
              key={anchor.id}
              className="grid grid-cols-[1.5fr_0.75fr_0.8fr_0.8fr_1fr_1.2fr] items-center gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{anchor.name}</p>
                <p className="truncate text-xs text-muted-foreground">{anchor.domain}</p>
                <p className="truncate text-[10px] text-muted-foreground/70">{anchor.id}</p>
              </div>
              <div>
                <Badge
                  variant="outline"
                  className={cn(
                    "w-fit",
                    anchor.network === "testnet"
                      ? "border-primary/30 text-primary"
                      : "border-success/30 text-success"
                  )}
                >
                  {anchor.network === "testnet" ? "Testnet" : "Mainnet"}
                </Badge>
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {anchor.country} / {anchor.currency}
                </p>
                <p className="text-xs text-muted-foreground">{anchor.type}</p>
              </div>
              <div className="flex flex-col gap-1">
                <Badge
                  variant="outline"
                  className={cn(
                    "w-fit",
                    anchor.active
                      ? "border-success/30 text-success"
                      : "border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {anchor.active ? "Active" : "Disabled"}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    "w-fit",
                    anchor.capabilities.operational
                      ? "border-primary/30 text-primary"
                      : "border-destructive/30 text-destructive"
                  )}
                >
                  {anchor.capabilities.operational ? "Operational" : "Not ready"}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1">
                {(["sep10", "sep24", "sep6", "sep31"] as const).map((key) => (
                  <span
                    key={key}
                    className={cn(
                      "rounded-md border px-1.5 py-0.5 text-[10px]",
                      anchor.capabilities[key]
                        ? "border-success/30 text-success"
                        : "border-border text-muted-foreground"
                    )}
                  >
                    {key.toUpperCase()}
                  </span>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => runAction({ action: "refresh", id: anchor.id }, anchor.id)}
                  disabled={workingId === anchor.id}
                >
                  <Activity className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    runAction(
                      { action: "set_active", id: anchor.id, active: !anchor.active },
                      anchor.id
                    )
                  }
                  disabled={workingId === anchor.id}
                >
                  {anchor.active ? "Disable" : "Enable"}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (confirm(`Delete ${anchor.id}?`)) {
                      void runAction({ action: "delete", id: anchor.id }, anchor.id);
                    }
                  }}
                  disabled={workingId === anchor.id}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              No anchors loaded.
            </div>
          )}
          {filtered.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                Rows {pageStart}-{pageEnd} of {filtered.length}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={currentPage <= 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span>
                  Page {currentPage} / {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setPage((value) => Math.min(totalPages, value + 1))
                  }
                  disabled={currentPage >= totalPages}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function AdminPage() {
  return (
    <WalletProvider>
      <AdminPageContent />
    </WalletProvider>
  );
}
