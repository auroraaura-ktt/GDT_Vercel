import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { apiRequest } from "../lib/api";

export const AuthContext = createContext(null);

function readStoredAuth() {
  if (typeof window === "undefined") {
    return { token: null, user: null };
  }

  try {
    const storedValue = window.localStorage.getItem("miitverse-auth");
    if (!storedValue) {
      return { token: null, user: null };
    }

    const parsed = JSON.parse(storedValue);
    return {
      token: parsed?.token ?? null,
      user: parsed?.user ?? null,
    };
  } catch {
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readStoredAuth);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (auth?.token || auth?.user) {
        window.localStorage.setItem("miitverse-auth", JSON.stringify(auth));
      } else {
        window.localStorage.removeItem("miitverse-auth");
      }
    }
  }, [auth]);

  const loadCurrentUser = async () => {
    if (!auth?.token) {
      setReady(true);
      return;
    }

    try {
      const data = await apiRequest("/users/me", {
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
      });

      setAuth((currentAuth) => ({
        token: currentAuth?.token ?? auth?.token,
        user: data.user || currentAuth?.user || null,
      }));
    } catch (error) {
      console.warn("Failed to load current auth user:", error);
      setAuth({ token: null, user: null });
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("miitverse-auth");
      }
    } finally {
      setReady(true);
    }
  };

  useEffect(() => {
    loadCurrentUser();
  }, [auth?.token]);

  const login = async (payload) => {
    const data = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const nextAuth = {
      token: data.token,
      user: data.user,
    };

    setAuth(nextAuth);

    if (typeof window !== "undefined") {
      window.localStorage.setItem("miitverse-auth", JSON.stringify(nextAuth));
    }

    return data;
  };

  const register = async (payload) => {
    const data = await apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return data;
  };

  const logout = () => {
    setAuth({ token: null, user: null });
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("miitverse-auth");
    }
  };

  const updateProfile = async (payload) => {
    const data = await apiRequest("/users/me", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${auth?.token}`,
      },
      body: JSON.stringify(payload),
    });

    setAuth((currentAuth) => ({
      token: currentAuth?.token ?? auth?.token,
      user: data.user,
    }));

    return data.user;
  };

  const updateAvatar = async (file) => {
    const formData = new FormData();
    formData.append("avatar", file);

    const data = await apiRequest("/users/me/avatar", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${auth?.token}`,
      },
      body: formData,
    });

    setAuth((currentAuth) => ({
      token: currentAuth?.token ?? auth?.token,
      user: data.user,
    }));

    return data.user;
  };

  const changePassword = async (payload) => {
    const data = await apiRequest("/users/me/password", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${auth?.token}`,
      },
      body: JSON.stringify(payload),
    });

    return data;
  };

  const value = useMemo(
    () => ({
      auth,
      user: auth?.user ?? null,
      token: auth?.token ?? null,
      isAuthenticated: Boolean(auth?.token),
      ready,
      loading: !ready,
      setUser: (user) => setAuth((currentAuth) => ({ ...currentAuth, user })),
      setAuth,
      loadCurrentUser,
      login,
      register,
      logout,
      updateProfile,
      updateAvatar,
      changePassword,
    }),
    [auth, ready]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}