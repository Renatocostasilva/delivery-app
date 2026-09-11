import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CartProvider } from '../../context/CartContext';
import type { CartItem } from '../../context/CartContext';
import { CheckoutProvider } from '../../context/CheckoutContext';
import { CheckoutFlow } from './CheckoutFlow';
import { IdentifyStep } from './IdentifyStep';
import { DeliveryStep } from './DeliveryStep';
import { SummaryStep } from './SummaryStep';
import { PaymentPage } from './PaymentPage';

const itemLocal: CartItem = {
  key: '1::',
  produtoId: 1,
  produtoNome: 'Pizza Margherita',
  precoUnitario: 49.9,
  quantidade: 1,
  imagem: 'https://example.com/pizza.jpg',
  variacao: null,
  adicionais: [],
};

const expiraEm = new Date(Date.now() + 30 * 60 * 1000).toISOString();
const criadoEm = new Date().toISOString();

const cartResponse = {
  cartKey: 'cart-1',
  status: 'ATIVO',
  itens: [{
    id: 1,
    produtoId: 1,
    produtoNome: 'Pizza Margherita',
    variacaoId: null,
    variacaoNome: null,
    precoBase: '49.90',
    precoVariacao: '0',
    adicionais: [],
    precoUnitario: '49.90',
    quantidade: 1,
    subtotal: '49.90',
    observacoes: null,
    indisponivel: false,
    motivoIndisponibilidade: null,
  }],
  subtotalProdutos: '49.90',
  taxaEntrega: '0',
  desconto: '0',
  total: '64.90',
  cupom: null,
  itensPendentes: false,
};

const resumo = {
  cartKey: 'cart-1',
  itens: cartResponse.itens,
  subtotalProdutos: '49.90',
  taxaEntrega: '15.00',
  desconto: '0',
  total: '64.90',
  cupom: null,
  itensPendentes: false,
};

const pedido = {
  id: 10,
  numeroPedido: 'PED-20260911-00001',
  statusPedido: 'AGUARDANDO_PAGAMENTO',
  statusPagamento: 'INICIADO',
  tipoEntrega: 'ENTREGA',
  enderecoSnapshot: {
    logradouro: 'Rua das Flores',
    numero: '45',
    complemento: null,
    bairro: 'Centro',
    cidade: 'São Paulo',
    cep: '01000000',
    referencia: null,
  },
  taxasEntrega: '15.00',
  desconto: '0',
  totalProdutos: '49.90',
  total: '64.90',
  observacoes: null,
  cliente: { id: 1, nome: 'Maria', telefone: '11999999999' },
  itens: [{
    id: 1,
    produtoId: 1,
    produtoNome: 'Pizza Margherita',
    variacaoNome: null,
    quantidade: 1,
    precoUnitario: '49.90',
    adicionais: null,
    observacoes: null,
    total: '49.90',
  }],
  pagamentos: [{
    id: 1,
    gateway: 'mercadopago',
    estadoPagamento: 'INICIADO',
    meioPagamento: 'pix',
    idGateway: null,
    valor: '64.90',
    qrCode: null,
    qrCodeBase64: null,
    expiraEm: null,
    tentativas: 1,
    sincronizadoEm: null,
    ultimoErroGateway: null,
    createdAt: criadoEm,
    updatedAt: criadoEm,
  }],
};

const cobranca = {
  criada: true,
  pedido: {
    id: 10,
    numeroPedido: 'PED-20260911-00001',
    statusPedido: 'AGUARDANDO_PAGAMENTO',
    statusPagamento: 'INICIADO',
    total: '64.90',
  },
  pagamento: {
    id: 2,
    gateway: 'mercadopago',
    estadoPagamento: 'PENDENTE',
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
  },
};

const consultaPendente = {
  sincronizado: true,
  pedido: {
    id: 10,
    numeroPedido: 'PED-20260911-00001',
    statusPedido: 'AGUARDANDO_PAGAMENTO',
    statusPagamento: 'INICIADO',
    total: '64.90',
    createdAt: criadoEm,
  },
  pagamento: cobranca.pagamento,
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
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const full = String(url);
    const method = init?.method ?? 'GET';

    if (method === 'POST' && full.endsWith('/api/cart')) {
      return json(201, { cartKey: 'cart-1' });
    }
    if (method === 'POST' && full.includes('/api/cart/cart-1/items')) {
      return json(201, cartResponse);
    }
    if (method === 'POST' && full.endsWith('/api/checkout/identify')) {
      return json(200, { cliente: { id: 1, nome: 'Maria', telefone: '11999999999' } });
    }
    if (method === 'POST' && full.endsWith('/api/checkout/delivery')) {
      return json(200, {
        cartKey: 'cart-1',
        tipoEntrega: 'ENTREGA',
        endereco: pedido.enderecoSnapshot,
        taxaEntrega: '15.00',
      });
    }
    if (method === 'POST' && full.endsWith('/api/checkout/summary')) {
      return json(200, resumo);
    }
    if (method === 'POST' && full.endsWith('/api/checkout/confirm')) {
      return json(201, pedido);
    }
    if (method === 'POST' && full.includes('/api/payments/10/cobrancas')) {
      return json(201, cobranca);
    }
    if (method === 'GET' && full.includes('/api/payments/10')) {
      return json(200, consultaPendente);
    }
    throw new Error(`URL não esperada: ${method} ${full}`);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderCheckout() {
  return render(
    <MemoryRouter initialEntries={['/checkout']}>
      <CartProvider>
        <CheckoutProvider>
          <Routes>
            <Route path="/checkout" element={<CheckoutFlow />}>
              <Route index element={<Navigate to="/checkout/identificacao" replace />} />
              <Route path="identificacao" element={<IdentifyStep />} />
              <Route path="entrega" element={<DeliveryStep />} />
              <Route path="resumo" element={<SummaryStep />} />
            </Route>
            <Route
              path="/checkout/pagamento/:pedidoId"
              element={<PaymentPage pollMs={50} />}
            />
          </Routes>
        </CheckoutProvider>
      </CartProvider>
    </MemoryRouter>,
  );
}

describe('CheckoutFlow', () => {
  it('percorre identificação, entrega, resumo e chega ao PIX', async () => {
    localStorage.setItem('delivery-app:cart', JSON.stringify({ items: [itemLocal] }));
    renderCheckout();

    // Etapa 1 — identificação (após sincronizar o carrinho no servidor)
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Identificação' }),
    ).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByLabelText('Nome completo')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'Maria' } });
    fireEvent.change(screen.getByLabelText('WhatsApp / telefone'), {
      target: { value: '(11) 99999-9999' },
    });
    fireEvent.change(screen.getByLabelText('E-mail (para o recibo)'), {
      target: { value: 'maria@email.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    // Etapa 2 — entrega
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Entrega' }),
    ).toBeTruthy();
    fireEvent.click(screen.getAllByRole('radio')[1]); // Entrega no endereço
    await waitFor(() => {
      expect(screen.getByLabelText('Logradouro')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Logradouro'), { target: { value: 'Rua das Flores' } });
    fireEvent.change(screen.getByLabelText('Número'), { target: { value: '45' } });
    fireEvent.change(screen.getByLabelText('Bairro'), { target: { value: 'Centro' } });
    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'São Paulo' } });
    fireEvent.change(screen.getByLabelText('CEP'), { target: { value: '01000-000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    // Etapa 3 — resumo
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Confirmação' }),
    ).toBeTruthy();
    await waitFor(() => {
      expect(screen.getAllByText('R$ 64,90').length).toBeGreaterThan(0);
    });
    expect(screen.getByText('Pizza Margherita')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Confirmar pedido/ }));

    // Etapa 4 — pagamento PIX (QR + copia-e-cola)
    expect(await screen.findByText('Copia-e-cola')).toBeTruthy();
    expect(screen.getByTitle('PIX-1001-123')).toBeTruthy();
    expect(screen.getByAltText('QR Code Pix')).toBeTruthy();
    expect(screen.getByText('PED-20260911-00001')).toBeTruthy();

    // carrinho local esvaziado após confirmar
    expect(JSON.parse(localStorage.getItem('delivery-app:cart') ?? '{"items":[]}').items).toEqual([]);
  });
});