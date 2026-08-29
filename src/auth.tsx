import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ApiError, apiGet, apiPost } from "./api";
import type { User } from "./types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (
    username: string,
    password: string,
    captchaId: string,
    captchaOptionId: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    apiGet<{ user: User }>("/api/auth/me", controller.signal)
      .then((response) => {
        if (active) setUser(response.user);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          setUser(null);
          return;
        }
        setError(error instanceof Error ? error.message : "无法确认登录状态");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const login = useCallback(async (
    username: string,
    password: string,
    captchaId: string,
    captchaOptionId: string,
  ) => {
    const response = await apiPost<{ user: User }>("/api/auth/login", {
      username,
      password,
      captchaId,
      captchaOptionId,
    });
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    await apiPost<void>("/api/auth/logout", {});
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const response = await apiGet<{ user: User }>("/api/auth/me");
    setUser(response.user);
    return response.user;
  }, []);

  const value = useMemo(
    () => ({ user, loading, error, login, logout, refreshUser }),
    [user, loading, error, login, logout, refreshUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}

export function RequireAuth() {
  const { user, loading, error } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="auth-loading" role="status">正在确认登录状态…</div>;
  }
  if (error) {
    return <div className="auth-loading auth-failed" role="alert">登录状态检查失败：{error}</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function RequireAdmin() {
  const { user } = useAuth();
  if (!user?.isAdmin) return <Navigate to="/modules" replace />;
  return <Outlet />;
}

export function RequireModule({ moduleId }: { moduleId: string }) {
  const { user } = useAuth();
  if (!user?.moduleIds.includes(moduleId)) return <Navigate to="/modules" replace />;
  return <Outlet />;
}
