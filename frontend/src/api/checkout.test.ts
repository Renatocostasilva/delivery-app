import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as api from './checkout';
import { ApiError } from './checkout';
import type { CartItem } from '../context/CartContext';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetchOk(body: unknown, status = 200) {
  fetchMock.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    json: async () => body,
  });
}

function urlOf(call: unknown[]): string {
  return String(call[0]);
}

function bodyOf(call: unknown[]): unknown {
  const init = call[1];
  return init && typeof init === 'object' && 'body' in init
    ? JSON.parse(String((init as { body: unknown }).body))
    : undefined;
}

const itemLocal: CartItem = {
  key: '1::2',
  produtoId: 1,
  produtoNome: 'Pizza Margherita',
  precoUnitario: 49.9,
  quantidade: 2,
  variacao: { id: 2, nome: 'Grande', precoAdicional: '10.00' },
  adicionais: [{ id: 3, nome: 'Borda', precoAdicional: '5.00', quantidade: 1 }],
  observacoes: 'Sem cebola',
};

describe('api checkout', () => {
  it('criarCarrinhoServidor POSTs /api/cart', async () => {
    mockFetchOk({ cartKey: 'cart-1' }, 201);
    const res = await api.criarCarrinhoServidor();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(urlOf(fetchMock.mock.calls[0])).toContain('/api/cart');
    expect(String(fetchMock.mock.calls[0][1]?.method)).toBe('POST');
    expect(res).toEqual({ cartKey: 'cart-1' });
  });

  it('adicionarItemServidor POSTs item body to /api/cart/:cartKey/items', async () => {
    mockFetchOk({ cartKey: 'cart-1', status: 'ATIVO', itens: [], subtotalProdutos: '0', taxaEntrega: '0', desconto: '0', total: '0', cupom: null, itensPendentes: false }, 201);
    await api.adicionarItemServidor('cart-1', {
      produtoId: 1,
      variacaoId: 2,
      quantidade: 2,
      adicionaisSelecionados: [{ adicionalId: 3, quantidade: 1 }],
      observacoes: 'Sem cebola',
    });

    expect(urlOf(fetchMock.mock.calls[0])).toContain('/api/cart/cart-1/items');
    expect(bodyOf(fetchMock.mock.calls[0])).toEqual({
      produtoId: 1,
      variacaoId: 2,
      quantidade: 2,
      adicionaisSelecionados: [{ adicionalId: 3, quantidade: 1 }],
      observacoes: 'Sem cebola',
    });
  });

  it('itemParaServidor mapeia CartItem local', () => {
    expect(api.itemParaServidor(itemLocal)).toEqual({
      produtoId: 1,
      variacaoId: 2,
      quantidade: 2,
      adicionaisSelecionados: [{ adicionalId: 3, quantidade: 1 }],
      observacoes: 'Sem cebola',
    });
  });

  it('identificarCliente POSTs nome e telefone', async () => {
    mockFetchOk({ cliente: { id: 1, nome: 'Maria', telefone: '11999999999' } });
    await api.identificarCliente('cart-1', 'Maria', '11999999999');

    expect(urlOf(fetchMock.mock.calls[0])).toContain('/api/checkout/identify');
    expect(bodyOf(fetchMock.mock.calls[0])).toEqual({
      cartKey: 'cart-1',
      nome: 'Maria',
      telefone: '11999999999',
    });
  });

  it('definirEntrega POSTs tipo e endereco', async () => {
    mockFetchOk({
      cartKey: 'cart-1',
      tipoEntrega: 'ENTREGA',
      endereco: { logradouro: 'Rua A', numero: '10', complemento: null, bairro: 'Centro', cidade: 'SP', cep: '00000000', referencia: null },
      taxaEntrega: '15.00',
    });
    await api.definirEntrega('cart-1', 'ENTREGA', {
      logradouro: 'Rua A',
      numero: '10',
      bairro: 'Centro',
      cidade: 'SP',
      cep: '00000000',
    });

    expect(bodyOf(fetchMock.mock.calls[0])).toEqual({
      cartKey: 'cart-1',
      tipoEntrega: 'ENTREGA',
      endereco: {
        logradouro: 'Rua A',
        numero: '10',
        bairro: 'Centro',
        cidade: 'SP',
        cep: '00000000',
      },
    });
  });

  it('definirEntrega omite endereco na retirada', async () => {
    mockFetchOk({ cartKey: 'cart-1', tipoEntrega: 'RETIRADA', endereco: null, taxaEntrega: '0' });
    await api.definirEntrega('cart-1', 'RETIRADA', null);

    expect(bodyOf(fetchMock.mock.calls[0])).toEqual({ cartKey: 'cart-1', tipoEntrega: 'RETIRADA' });
  });

  it('confirmarPedido POSTs o corpo completo', async () => {
    mockFetchOk({ id: 10 }, 201);
    await api.confirmarPedido({
      cartKey: 'cart-1',
      idempotencyKey: 'idem-1',
      nome: 'Maria',
      telefone: '11999999999',
      tipoEntrega: 'ENTREGA',
      endereco: null,
      observacoes: 'portaria',
    });

    expect(urlOf(fetchMock.mock.calls[0])).toContain('/api/checkout/confirm');
    expect(bodyOf(fetchMock.mock.calls[0])).toEqual({
      cartKey: 'cart-1',
      idempotencyKey: 'idem-1',
      nome: 'Maria',
      telefone: '11999999999',
      tipoEntrega: 'ENTREGA',
      endereco: null,
      observacoes: 'portaria',
    });
  });

  it('criarCobranca POSTs metodo e email do pagador', async () => {
    mockFetchOk({ criada: true }, 201);
    await api.criarCobranca(10, { metodo: 'pix', email: 'maria@email.com' });

    expect(urlOf(fetchMock.mock.calls[0])).toContain('/api/payments/10/cobrancas');
    expect(bodyOf(fetchMock.mock.calls[0])).toEqual({ metodo: 'pix', email: 'maria@email.com' });
  });

  it('consultarPagamento faz GET com sync=true', async () => {
    mockFetchOk({ sincronizado: true });
    await api.consultarPagamento(10, true);

    expect(urlOf(fetchMock.mock.calls[0])).toContain('/api/payments/10?sync=true');
    expect(String(fetchMock.mock.calls[0][1]?.method ?? 'GET')).toBe('GET');
  });

  it('lança ApiError com a mensagem do corpo', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: async () => ({ error: 'Carrinho vazio.' }),
    });

    await expect(api.resumoPedido('cart-1', 'ENTREGA')).rejects.toMatchObject({
      name: 'ApiError',
      status: 422,
      message: 'Carrinho vazio.',
    });
    expect(ApiError).toBeDefined();
  });

  it('lança ApiError com mensagem padrão quando corpo não é JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => {
        throw new Error('parse');
      },
    });

    await expect(api.resumoPedido('cart-1', 'ENTREGA')).rejects.toMatchObject({
      status: 500,
      message: 'API 500: Internal Server Error',
    });
  });
});