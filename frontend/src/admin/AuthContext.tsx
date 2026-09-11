/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { adminLogin, adminLogout, readSession, saveSession, clearSession } from './api';
import type { AdminUser } from './types';

interface AuthContextValue {
  admin: AdminUser | null;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(() => readSession()?.admin ?? null);

  async function login(email: string, senha: string): Promise<void> {
    const res = await adminLogin({ email, senha });
    saveSession(res);
    setAdmin(res.admin);
  }

  async function logout(): Promise<void> {
    try {
      await adminLogout();
    } catch {
      // servidor indisponível: encerra a sessão local mesmo assim
    }
    clearSession();
    setAdmin(null);
  }

  return (
    <AuthContext.Provider value={{ admin, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  }
  return ctx;
}