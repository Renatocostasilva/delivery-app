import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CartProvider } from '../../context/CartContext';
import { CheckoutProvider } from '../../context/CheckoutContext';
import { PaymentPage } from './PaymentPage';

const criadoEm = new Date().toISOString();
const expiraEm = new Date(Date.now() + 30 * 60 * 1000).toISOString();

function pagamento(estado: string) {
  return {
    id: 2,
    gateway: 'mercadopago',
    estadoPagamento: estado,
    meioPagamento: 'pix',
    idGateway: '1001',
    valor: '64.90',
    qrCode: 'PIX-1001-123',
    qrCodeBase64: 'base64-qr-1001',
    expiraEm,
    tentativas: 1,
    sincronizadoEm: null,
    ultimoErroGateway: null,
    createdAt: criadoEm,
    updatedAt: criadoEm,
  };
}

const basePedido = {
  id: 10,
  numeroPedido: 'PED-20260911-00001',
  statusPedido: 'AGUARDANDO_PAGAMENTO',
  statusPagamento: 'INICIADO',
  total: '64.90',
};

const fetchMock = vi.fn();

function json(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    json: async () => body,
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

function renderPayment(statusConsulta: string = 'PENDENTE') {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const full = String(url);
    const method = init?.method ?? 'GET';

    if (method === 'POST' && full.includes('/api/payments/10/cobrancas')) {
      return json(201, { criada: true, pedido: basePedido, pagamento: pagamento('PENDENTE') });
    }
    if (method === 'GET' && full.includes('/api/payments/10')) {
      return json(200, {
        sincronizado: true,
        pedido: {
          ...basePedido,
          statusPedido: statusConsulta === 'APROVADO' ? 'PAGAMENTO_APROVADO' : 'AGUARDANDO_PAGAMENTO',
          statusPagamento: statusConsulta,
          createdAt: criadoEm,
        },
        pagamento: pagamento(statusConsulta),
      });
    }
    throw new Error(`URL não esperada: ${method} ${full}`);
  });

  return render(
    <MemoryRouter initialEntries={['/checkout/pagamento/10']}>
      <CartProvider>
        <CheckoutProvider>
          <Routes>
            <Route
              path="/checkout/pagamento/:pedidoId"
              element={<PaymentPage pollMs={20} />}
            />
            <Route path="/pedido/:id" element={<div>PEDIDO OK</div>} />
          </Routes>
        </CheckoutProvider>
      </CartProvider>
    </MemoryRouter>,
  );
}

describe('PaymentPage', () => {
  it('mostra QR do Pix após gerar a cobrança', async () => {
    renderPayment('PENDENTE');

    expect(await screen.findByText('Copia-e-cola')).toBeTruthy();
    expect(screen.getByAltText('QR Code Pix')).toBeTruthy();
    expect(screen.getByText('PED-20260911-00001')).toBeTruthy();
    expect(screen.getByText(/Total: R\$ 64,90/)).toBeTruthy();
  });

  it('navega para o pedido quando o pagamento é aprovado', async () => {
    renderPayment('APROVADO');

    expect(await screen.findByText('PEDIDO OK')).toBeTruthy();
  });

  it('mostra tela de falha com pagar novamente', async () => {
    renderPayment('RECUSADO');

    expect(await screen.findByText('Pagamento recusado.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pagar novamente' })).toBeTruthy();
    expect(screen.queryByText('PEDIDO OK')).toBeNull();
  });
});