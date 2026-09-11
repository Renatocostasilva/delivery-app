import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderAdmin, mockFetchHandler, ok, seedSession } from './testUtils';

const detalheFixture = {
  id: 1,
  nome: 'Ana Souza',
  telefone: '+5511999990000',
  email: 'ana@exemplo.com',
  ativo: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  enderecos: [
    {
      id: 1,
      logradouro: 'Rua A',
      numero: '10',
      bairro: 'Centro',
      cidade: 'São Paulo',
      cep: '01001000',
      complemento: null,
      referencia: null,
      principal: true,
    },
  ],
  resumo: {
    totalPedidos: 2,
    totalComprado: '150.50',
    primeiroPedido: {
      id: 9,
      numeroPedido: 'PD-9',
      total: '70.50',
      statusPedido: 'CANCELADO',
      statusPagamento: 'CANCELADO',
      createdAt: '2026-01-05T00:00:00Z',
    },
    ultimoPedido: {
      id: 10,
      numeroPedido: 'PD-10',
      total: '80.00',
      statusPedido: 'ENTREGUE',
      statusPagamento: 'APROVADO',
      createdAt: '2026-06-01T00:00:00Z',
    },
  },
  pedidos: [
    {
      id: 10,
      numeroPedido: 'PD-10',
      statusPedido: 'ENTREGUE',
      statusPagamento: 'APROVADO',
      tipoEntrega: 'ENTREGA',
      total: '80.00',
      createdAt: '2026-06-01T00:00:00Z',
      itens: [
        {
          produtoNome: 'Bolo',
          variacaoNome: null,
          quantidade: 1,
          precoUnitario: '80.00',
          total: '80.00',
        },
      ],
    },
  ],
};

beforeEach(() => {
  sessionStorage.clear();
});

describe('ClientDetailPage', () => {
  it('exibe dados do cliente, resumo de compras, endereços e pedidos', async () => {
    seedSession();
    mockFetchHandler((url) => {
      if (url.includes('/api/admin/clients/1')) return ok(detalheFixture);
      return ok({});
    });
    renderAdmin('/admin/clientes/1');
    await waitFor(() => {
      expect(screen.getByText('Ana Souza')).toBeTruthy();
    });
    expect(screen.getByText(/\+5511999990000/)).toBeTruthy();
    expect(screen.getByText(/Rua A/)).toBeTruthy();
    expect(screen.getByText('R$ 150,50')).toBeTruthy();
    expect(screen.getAllByText('R$ 80,00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PD-10').length).toBeGreaterThan(0);
  });
});