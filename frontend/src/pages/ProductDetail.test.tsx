import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductDetail } from './ProductDetail';
import { CartPage } from './CartPage';
import { CartProvider } from '../context/CartContext';

const produto = {
  id: 1,
  nome: 'Pizza Margherita',
  sku: 'PIZZA-MARG',
  subcategoria: null,
  descricaoCurta: 'Massa fina, molho, muçarela e manjericão.',
  descricaoCompleta: null,
  ingredientes: 'Massa, molho de tomate, muçarela, manjericão.',
  observacoesInfo: null,
  disponivel: true,
  emDestaque: true,
  maisVendido: false,
  precoVenda: '58.90',
  precoPromocional: '49.90',
  emPromocao: true,
  controlarEstoque: false,
  estoqueAtual: 50,
  estoqueMinimo: 5,
  pesoVolume: null,
  categoria: { id: 1, nome: 'Pizzas', slug: 'pizzas' },
  imagens: [{ id: 1, url: 'https://example.com/pizza.jpg', principal: true }],
  variacoes: [
    { id: 1, nome: 'Pequena', precoAdicional: '0', ativo: true, ordem: 1 },
    { id: 2, nome: 'Grande', precoAdicional: '12.00', ativo: true, ordem: 2 },
  ],
  adicionais: [
    {
      id: 1,
      nome: 'Borda de catupiry',
      precoAdicional: '8.00',
      obrigatorio: false,
      quantidadeMinima: 0,
      quantidadeMaxima: 1,
      ativo: true,
      ordem: 1,
    },
    {
      id: 2,
      nome: 'Molho especial',
      precoAdicional: '2.50',
      obrigatorio: false,
      quantidadeMinima: 0,
      quantidadeMaxima: 2,
      ativo: true,
      ordem: 2,
    },
  ],
};

function renderProductDetail() {
  return render(
    <MemoryRouter initialEntries={['/produto/1']}>
      <CartProvider>
        <Routes>
          <Route path="/produto/:id" element={<ProductDetail />} />
          <Route path="/carrinho" element={<CartPage />} />
        </Routes>
      </CartProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  localStorage.clear();
});

describe('ProductDetail', () => {
  it('renders product name, category, description and promo price', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => produto,
    });
    renderProductDetail();

    expect(await screen.findByText('Pizza Margherita')).toBeTruthy();
    expect(screen.getByText('Pizzas')).toBeTruthy();
    expect(screen.getByText('Massa fina, molho, muçarela e manjericão.')).toBeTruthy();
    expect(screen.getByText('R$ 49,90')).toBeTruthy();
    expect(screen.getByText('R$ 58,90')).toBeTruthy();
  });

  it('shows error state when product fetch fails', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });
    renderProductDetail();

    expect(await screen.findByText(/API 404/)).toBeTruthy();
  });

  it('updates unit price when a variant is selected', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => produto,
    });
    renderProductDetail();

    await screen.findByText('Pizza Margherita');
    expect(screen.getByText(/Adicionar • R\$ 49,90/)).toBeTruthy();

    fireEvent.click(screen.getByText('Grande'));
    expect(screen.getByText(/Adicionar • R\$ 61,90/)).toBeTruthy();
  });

  it('adds product to cart and navigates to cart page', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => produto,
    });
    renderProductDetail();

    await screen.findByText('Pizza Margherita');
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }));

    expect(await screen.findByText('Finalizar pedido')).toBeTruthy();
    expect(screen.getByText('Pizza Margherita')).toBeTruthy();
    expect(screen.getAllByText('R$ 49,90').length).toBeGreaterThan(0);
  });

  it('disables add button when product is unavailable', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ ...produto, disponivel: false }),
    });
    renderProductDetail();

    await screen.findByText('Pizza Margherita');
    const btn = screen.getByRole('button', { name: /Adicionar/ });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Indisponível')).toBeTruthy();
  });

  it('shows stock info and limits quantity when controlarEstoque', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ ...produto, controlarEstoque: true, estoqueAtual: 3 }),
    });
    renderProductDetail();

    await screen.findByText('Pizza Margherita');
    expect(screen.getByText('Restam 3')).toBeTruthy();
  });

  it('shows pesoVolume when present', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ ...produto, pesoVolume: '500g' }),
    });
    renderProductDetail();

    await screen.findByText('Pizza Margherita');
    expect(screen.getByText('500g')).toBeTruthy();
  });

  it('includes observacoes in cart item when submitting', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => produto,
    });
    renderProductDetail();

    await screen.findByText('Pizza Margherita');
    fireEvent.change(screen.getByPlaceholderText(/sem cebola/), {
      target: { value: 'Sem muçarela' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }));

    expect(await screen.findByText('Finalizar pedido')).toBeTruthy();
    expect(screen.getByText(/Sem muçarela/)).toBeTruthy();
  });

  it('pre-selects required addons at minimum quantity', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        ...produto,
        adicionais: [
          {
            id: 10,
            nome: 'Molho obrigatório',
            precoAdicional: '3.00',
            obrigatorio: true,
            quantidadeMinima: 1,
            quantidadeMaxima: 2,
            ativo: true,
            ordem: 1,
          },
        ],
      }),
    });
    renderProductDetail();

    await screen.findByText('Pizza Margherita');
    const btn = screen.getByRole('button', { name: /Adicionar/ });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    const steppers = screen.getAllByRole('button', { name: 'Diminuir' });
    expect((steppers[0] as HTMLButtonElement).disabled).toBe(true);
  });
});