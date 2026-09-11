import { describe, it, expect, beforeEach } from 'vitest';
import {
  renderAdmin,
  mockFetchHandler,
  ok,
  unauthorized,
  seedSession,
  SESSION_KEY,
} from './testUtils';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { readSession, saveSession, clearSession } from './api';

const dashboardFixture = {
  resumo: { totalPedidos: 12, totalVendas: 1200, totalFrete: 50, totalDescontos: 30, pedidosFinalizados: 9, ticketMedio: 100 },
  pedidosPorStatus: { RECEBIDO: 2, ENTREGUE: 3 },
  topProdutos: [],
  pedidosRecentes: [],
};

beforeEach(() => {
  sessionStorage.clear();
});

describe('Session helpers', () => {
  it('save and read session from sessionStorage', () => {
    saveSession({ token: 'tok', admin: { id: 1, email: 'a@b.com', nome: 'A' } });
    const s = readSession();
    expect(s?.token).toBe('tok');
    expect(s?.admin.nome).toBe('A');
  });

  it('clearSession removes stored data', () => {
    saveSession({ token: 'tok', admin: { id: 1, email: 'a@b.com', nome: 'A' } });
    clearSession();
    expect(readSession()).toBeNull();
  });
});

describe('AdminApp', () => {
  it('renders login when not authenticated', () => {
    mockFetchHandler(() => ok({}));
    renderAdmin('/admin');
    expect(screen.getByLabelText('E-mail')).toBeTruthy();
    expect(screen.getByLabelText('Senha')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy();
  });

  it('navigates to dashboard after successful login', async () => {
    mockFetchHandler((url) => {
      if (url.includes('/api/admin/auth/login')) {
        return ok({ token: 'jwt123', admin: { id: 1, email: 'admin@test.com', nome: 'Admin' } });
      }
      if (url.includes('/api/admin/dashboard')) {
        return ok(dashboardFixture);
      }
      return ok({});
    });
    renderAdmin('/admin');
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'admin@test.com' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeTruthy();
    });
    expect(sessionStorage.getItem(SESSION_KEY)).not.toBeNull();
  });

  it('shows error on invalid credentials', async () => {
    mockFetchHandler((url) => {
      if (url.includes('/api/admin/auth/login')) {
        return unauthorized('Credenciais inválidas');
      }
      return ok({});
    });
    renderAdmin('/admin');
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'x@y.com' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'bad' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Credenciais inválidas');
    });
  });

  it('logs out and returns to login', async () => {
    seedSession();
    mockFetchHandler((url) => {
      if (url.includes('/api/admin/dashboard')) return ok(dashboardFixture);
      if (url.includes('/api/admin/auth/logout')) return ok({});
      return ok({});
    });
    renderAdmin('/admin/dashboard');
    await waitFor(() => {
      expect(screen.getByText('Total de pedidos')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    await waitFor(() => {
      expect(screen.getByLabelText('E-mail')).toBeTruthy();
    });
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });
});