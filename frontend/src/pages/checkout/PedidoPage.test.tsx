import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CartProvider } from '../../context/CartContext';
import { CheckoutProvider } from '../../context/CheckoutContext';
import { PedidoPage } from './PedidoPage';

const criadoEm = new Date().toISOString();
const expiraEm = new Date(Date.now() + 30 * 60 * 1000).toISOString();

const fetchMock = vi.fn();

function json(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: '',
    json: async () => body,
  };
}

function consulta(
  statusPedido: string,
  estadoPagamento: string,
  total = '64.90',
) {
  return {
    sincronizado: true,
    pedido: {
      id: 10,
      numeroPedido: 'PED-20260911-00001',
      statusPedido,
      statusPagamento: estadoPagamento,
      total,
      createdAt: criadoEm,
    },
    pagamento: {
      id: 2,
      gateway: 'mercadopago',
      estadoPagamento,
      meioPagamento: 'pix',
      idGateway: '1001',
      valor: total,
      qrCode: 'PIX-1001-123',
      qrCodeBase64: 'base64-qr-1001',
      expiraEm,
      tentativas: 1,
      sincronizadoEm: null,
      ultimoErroGateway: null,
      createdAt: criadoEm,
      updatedAt: criadoEm,
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderPedido() {
  return render(
    <MemoryRouter initialEntries={['/pedido/10']}>
      <CartProvider>
        <CheckoutProvider>
          <Routes>
            <Route path="/pedido/:id" element={<PedidoPage />} />
          </Routes>
        </CheckoutProvider>
      </CartProvider>
    </MemoryRouter>,
  );
}

describe('PedidoPage', () => {
  it('mostra sucesso quando o pagamento foi aprovado', async () => {
    fetchMock.mockResolvedValue(json(consulta('PAGAMENTO_APROVADO', 'APROVADO')) as unknown as Response);
    renderPedido();

    expect(await screen.findByText('Pedido confirmado e pago!')).toBeTruthy();
    expect(screen.getByText('PED-20260911-00001')).toBeTruthy();
    expect(screen.getAllByText('R$ 64,90').length).toBeGreaterThan(0);
    expect(screen.getByText('Pagamento aprovado')).toBeTruthy();
  });

  it('mostra pendência com link para o pagamento', async () => {
    fetchMock.mockResolvedValue(json(consulta('AGUARDANDO_PAGAMENTO', 'PENDENTE')) as unknown as Response);
    renderPedido();

    expect(await screen.findByText('Pagamento em confirmação')).toBeTruthy();
    expect(screen.getByText('Ver pagamento').closest('a')?.getAttribute('href')).toBe(
      '/checkout/pagamento/10',
    );
  });

  it('mostra falha com opção de pagar novamente', async () => {
    fetchMock.mockResolvedValue(json(consulta('RECUSADO', 'RECUSADO')) as unknown as Response);
    renderPedido();

    expect((await screen.findAllByText('Pagamento recusado')).length).toBeGreaterThan(0);
    expect(screen.getByText('Tentar pagar novamente').closest('a')?.getAttribute('href')).toBe(
      '/checkout/pagamento/10',
    );
  });
});