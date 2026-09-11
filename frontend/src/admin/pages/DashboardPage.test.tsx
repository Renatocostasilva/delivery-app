import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderAdmin, mockFetchHandler, ok, seedSession } from '../testUtils';

const dashboardFixture = {
  resumo: { totalPedidos: 5, totalVendas: 450.5, totalFrete: 20, totalDescontos: 10, pedidosFinalizados: 3, ticketMedio: 150 },
  pedidosPorStatus: { RECEBIDO: 2, EM_PREPARACAO: 1, ENTREGUE: 2 },
  topProdutos: [{ nome: 'Pizza', quantidadeVendida: 12, totalVendido: 360, vezesPedido: 10 }],
  pedidosRecentes: [{ id: 1, numeroPedido: '#001', status: 'RECEBIDO', total: '45.00', cliente: 'João', criadoEm: '2026-09-01T10:00:00Z' }],
};

beforeEach(() => {
  sessionStorage.clear();
});

describe('DashboardPage', () => {
  it('renders dashboard with resumo, top produtos, and pedidos recentes', async () => {
    seedSession();
    mockFetchHandler((url) => {
      if (url.includes('/api/admin/dashboard')) return ok(dashboardFixture);
      return ok({});
    });
    renderAdmin('/admin/dashboard');

    await waitFor(() => {
      expect(screen.getByText('Total de pedidos')).toBeTruthy();
    });
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('R$ 450,50')).toBeTruthy();
    expect(screen.getByText('Pizza')).toBeTruthy();
    expect(screen.getByText(/360,00/)).toBeTruthy();
    expect(screen.getByText('#001')).toBeTruthy();
    expect(screen.getByText('João')).toBeTruthy();
  });

  it('renders status counts', async () => {
    seedSession();
    mockFetchHandler((url) => {
      if (url.includes('/api/admin/dashboard')) return ok(dashboardFixture);
      return ok({});
    });
    renderAdmin('/admin/dashboard');

    await waitFor(() => {
      expect(screen.getByText('Pedidos por status')).toBeTruthy();
    });
    expect(screen.getAllByText('2')).toHaveLength(2);
    expect(screen.getAllByText('Recebido').length).toBeGreaterThan(0);
  });

  it('clears filter and reloads', async () => {
    seedSession();
    mockFetchHandler((url) => {
      if (url.includes('/api/admin/dashboard')) return ok(dashboardFixture);
      return ok({});
    });
    renderAdmin('/admin/dashboard');
    await waitFor(() => {
      expect(screen.getByText('Total de pedidos')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-09-01' } });
    fireEvent.click(screen.getByText('Filtrar'));
    await waitFor(() => {
      expect(screen.getByText('Total de pedidos')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Limpar'));
    await waitFor(() => {
      expect(screen.getByText('Total de pedidos')).toBeTruthy();
    });
  });
});