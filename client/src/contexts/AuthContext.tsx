import React, { createContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../libs/api";

interface User {
  id: string;
  name: string;
  role: string;
  department_id: number | null;
  department_name?: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (id: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const handleAuthSuccess = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    // Navigate to base path (login page) after logout
    navigate('/');
  };

  useEffect(() => {
    const restoreSession = () => {
      const storedToken = localStorage.getItem("token");
      const storedUser = localStorage.getItem("user");

      if (storedToken && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser) as User;
          setToken(storedToken);
          setUser(parsedUser);
        } catch (error) {
          console.warn("Failed to parse stored user data", error);
          logout();
        }
      }

      setLoading(false);
    };

    restoreSession();
  }, []);

 const login = async (id: string, password: string) => {
  try {
    const { data } = await api.post("/auth/login", { id, password });
    handleAuthSuccess(data.token, data.user);
  } catch (error: any) {
    // Re-throw the original error to preserve response data and status
    throw error;
  }
};

  const updateUser = (userData: Partial<User>) => {
    if (!user) return;

    const updatedUser = { ...user, ...userData };
    setUser(updatedUser);
    localStorage.setItem("user", JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider
      value={{ user, token, login, logout, updateUser, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
};

