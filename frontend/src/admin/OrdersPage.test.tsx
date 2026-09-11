import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderAdmin, mockFetchHandler, ok, seedSession } from './testUtils';

const ordersFixture = {
  data: [
    {
      id: 1,
      numeroPedido: '#001',
      clienteId: 10,
      statusPedido: 'RECEBIDO',
      statusPagamento: 'APROVADO',
      tipoEntrega: 'ENTREGA',
      taxasEntrega: '5.00',
      desconto: '0.00',
      totalProdutos: '45.00',
      total: '50.00',
      formaPagamento: 'PIX',
      observacoes: null,
      createdAt: '2026-09-01T10:00:00Z',
      updatedAt: '2026-09-01T10:00:00Z',
      cliente: { id: 10, nome: 'João Silva', telefone: '+5511999999999' },
      itens: [{ produtoNome: 'Pizza Margherita', quantidade: 1 }],
    },
  ],
  total: 1,
  page: 1,
  pageSize: 15,
};

const orderDetailFixture = {
  ...ordersFixture.data[0],
  cliente: { id: 10, nome: 'João Silva', telefone: '+5511999999999', email: 'joao@test.com' },
  enderecoSnapshot: { rua: 'Rua A', numero: '123' },
  itens: [
    {
      id: 100,
      pedidoId: 1,
      produtoId: 1,
      produtoNome: 'Pizza Margherita',
      variacaoNome: null,
      quantidade: 1,
      precoUnitario: '35.00',
      precoPromocionalUnitario: null,
      adicionais: [{ nome: 'Bacon', preco: '5.00' }],
      observacoes: 'Sem cebola',
      total: '40.00',
      createdAt: '2026-09-01T10:00:00Z',
    },
  ],
  pagamentos: [
    {
      id: 200,
      gateway: 'STONE',
      valor: '50.00',
      meioPagamento: 'PIX',
      estadoPagamento: 'APROVADO',
      tentativas: 1,
      idGateway: 'ext-123',
      qrCodeBase64: null,
      expiraEm: null,
      ultimoErroGateway: null,
      sincronizadoEm: null,
      createdAt: '2026-09-01T10:00:00Z',
    },
  ],
  historico: [
    { id: 300, pedidoId: 1, de: null, para: 'RECEBIDO', adminId: null, observacao: null, criadoEm: '2026-09-01T10:00:00Z' },
  ],
};

const receiptFixture = {
  numeroPedido: '#001',
  status: 'RECEBIDO',
  cliente: { nome: 'João Silva', telefone: '+5511999999999', email: 'joao@test.com' },
  itens: [{ nome: 'Pizza Margherita', variacao: null, quantidade: 1, precoUnitario: '35.00', adicionais: [{ nome: 'Bacon', preco: '5.00' }], total: '40.00' }],
  subtotal: '40.00',
  taxaEntrega: '5.00',
  desconto: '0.00',
  total: '45.00',
  formaPagamento: 'PIX',
  observacoes: null,
  criadoEm: '2026-09-01T10:00:00Z',
};

beforeEach(() => {
  sessionStorage.clear();
});

describe('OrdersPage', () => {
  it('lists orders with numero, cliente, status badge, and total', async () => {
    seedSession();
    mockFetchHandler((url) => {
      if (url.includes('/api/admin/orders')) return ok(ordersFixture);
      return ok({});
    });
    renderAdmin('/admin/pedidos');
    await waitFor(() => {
      expect(screen.getByText('#001')).toBeTruthy();
    });
    expect(screen.getByText('João Silva')).toBeTruthy();
    expect(screen.getAllByText(/Pizza Margherita/).length).toBeGreaterThan(0);
    expect(screen.getByText('R$ 50,00')).toBeTruthy();
    expect(screen.getAllByText('Recebido').length).toBeGreaterThan(0);
  });

  it('shows Ver link for each order', async () => {
    seedSession();
    mockFetchHandler((url) => {
      if (url.includes('/api/admin/orders')) return ok(ordersFixture);
      return ok({});
    });
    renderAdmin('/admin/pedidos');
    await waitFor(() => {
      expect(screen.getByText('Ver')).toBeTruthy();
    });
  });
});

describe('OrderDetailPage', () => {
  it('loads and displays order detail with items, payments, and history', async () => {
    seedSession();
    mockFetchHandler((url) => {
      if (url.includes('/api/admin/orders/1') && !url.includes('/receipt') && !url.includes('/history') && !url.includes('/payments') && !url.includes('/cancel') && !url.includes('/refund') && !url.includes('/status') && !url.includes('/clients')) return ok(orderDetailFixture);
      return ok({});
    });
    renderAdmin('/admin/pedidos/1');
    await waitFor(() => {
      expect(screen.getByText('Pedido #001')).toBeTruthy();
    });
    expect(screen.getByText('João Silva')).toBeTruthy();
    expect(screen.getByText(/joao@test\.com/)).toBeTruthy();
    expect(screen.getByText('Pizza Margherita')).toBeTruthy();
    expect(screen.getByText('Bacon (+R$ 5,00)')).toBeTruthy();
    expect(screen.getByText('Sem cebola')).toBeTruthy();
    expect(screen.getByText('STONE')).toBeTruthy();
    expect(screen.getByText('APROVADO')).toBeTruthy();
    expect(screen.getByText(/Rua A/)).toBeTruthy();
  });

  it('allows status change', async () => {
    let statusUpdated = false;
    seedSession();
    mockFetchHandler((url, init) => {
      if (init?.method === 'PATCH' && url.includes('/api/admin/orders/1/status')) {
        statusUpdated = true;
        return ok({ ...orderDetailFixture, statusPedido: 'EM_PREPARACAO' });
      }
      if (url.includes('/api/admin/orders/1') && !url.includes('/receipt') && !url.includes('/history') && !url.includes('/payments') && !url.includes('/cancel') && !url.includes('/refund') && !url.includes('/status') && !url.includes('/clients')) return ok(orderDetailFixture);
      return ok({});
    });
    renderAdmin('/admin/pedidos/1');
    await waitFor(() => {
      expect(screen.getByText('Pedido #001')).toBeTruthy();
    });
    const statusButton = screen.getByRole('button', { name: 'Atualizar status' });
    await waitFor(() => {
      expect(statusButton).toBeEnabled();
    });
    fireEvent.click(statusButton);
    await waitFor(() => {
      expect(statusUpdated).toBe(true);
    });
  });

  it('allows cancelling an order', async () => {
    let cancelCalled = false;
    seedSession();
    mockFetchHandler((url, init) => {
      if (init?.method === 'POST' && url.includes('/api/admin/orders/1/cancel')) {
        cancelCalled = true;
        return ok({});
      }
      if (url.includes('/api/admin/orders/1') && !url.includes('/receipt') && !url.includes('/history') && !url.includes('/payments') && !url.includes('/cancel') && !url.includes('/refund') && !url.includes('/status') && !url.includes('/clients')) return ok(orderDetailFixture);
      return ok({});
    });
    renderAdmin('/admin/pedidos/1');
    await waitFor(() => {
      expect(screen.getByText('Pedido #001')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Motivo do cancelamento'), { target: { value: 'Cliente desistiu' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar pedido' }));
    await waitFor(() => {
      expect(cancelCalled).toBe(true);
    });
  });

  it('shows refund button when payment is approved', async () => {
    seedSession();
    mockFetchHandler((url) => {
      if (url.includes('/api/admin/orders/1') && !url.includes('/receipt') && !url.includes('/history') && !url.includes('/payments') && !url.includes('/cancel') && !url.includes('/refund') && !url.includes('/status') && !url.includes('/clients')) return ok(orderDetailFixture);
      return ok({});
    });
    renderAdmin('/admin/pedidos/1');
    await waitFor(() => {
      expect(screen.getByText('Pedido #001')).toBeTruthy();
    });
    expect(screen.getByLabelText('Motivo do estorno')).toBeTruthy();
    expect(screen.getByText('Estornar')).toBeTruthy();
  });

  it('loads and displays receipt when printing', async () => {
    seedSession();
    mockFetchHandler((url) => {
      if (url.includes('/receipt')) return ok(receiptFixture);
      if (url.includes('/api/admin/orders/1') && !url.includes('/history') && !url.includes('/payments') && !url.includes('/cancel') && !url.includes('/refund') && !url.includes('/status') && !url.includes('/clients')) return ok(orderDetailFixture);
      return ok({});
    });
    renderAdmin('/admin/pedidos/1');
    await waitFor(() => {
      expect(screen.getByText('Pedido #001')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir recibo' }));
    await waitFor(() => {
      expect(screen.getByText('Recibo — #001')).toBeTruthy();
    });
    expect(screen.getAllByText(/João Silva/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bacon (+R$ 5,00)').length).toBeGreaterThan(0);
  });

  it('bloqueia exclusão quando há pagamento não estornado', async () => {
    seedSession();
    mockFetchHandler((url) => {
      if (url.includes('/api/admin/orders/1') && !url.includes('/receipt') && !url.includes('/history') && !url.includes('/payments') && !url.includes('/cancel') && !url.includes('/refund') && !url.includes('/status') && !url.includes('/clients')) return ok(orderDetailFixture);
      return ok({});
    });
    renderAdmin('/admin/pedidos/1');
    await waitFor(() => {
      expect(screen.getByText('Pedido #001')).toBeTruthy();
    });
    expect(screen.getByText(/pagamento não estornado/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Excluir pedido' })).toBeNull();
  });

  it('exclui pedido com pagamento estornado após confirmação', async () => {
    seedSession();
    const estornado = {
      ...orderDetailFixture,
      pagamentos: [{ ...orderDetailFixture.pagamentos[0], estadoPagamento: 'ESTORNADO' }],
    };
    let deleted = false;
    mockFetchHandler((url, init) => {
      if (init?.method === 'DELETE' && url.includes('/api/admin/orders/1')) {
        deleted = true;
        return ok({ message: 'Pedido excluído.' });
      }
      if (url.includes('/api/admin/orders/1') && !url.includes('/receipt') && !url.includes('/history') && !url.includes('/payments') && !url.includes('/cancel') && !url.includes('/refund') && !url.includes('/status') && !url.includes('/clients')) return ok(estornado);
      return ok({});
    });
    renderAdmin('/admin/pedidos/1');
    await waitFor(() => {
      expect(screen.getByText('Pedido #001')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Excluir pedido' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão?' }));
    await waitFor(() => {
      expect(deleted).toBe(true);
    });
  });
});