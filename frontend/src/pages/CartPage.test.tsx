import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import { CartProvider } from '../context/CartContext';
import type { CartItem } from '../context/CartContext';
import { CartPage } from './CartPage';

const itemPizza: CartItem = {
  key: '1::',
  produtoId: 1,
  produtoNome: 'Pizza Margherita',
  precoUnitario: 49.9,
  quantidade: 1,
  imagem: 'https://example.com/pizza.jpg',
  variacao: null,
  adicionais: [],
};

const itemBolo: CartItem = {
  key: '2::',
  produtoId: 2,
  produtoNome: 'Bolo de Chocolate',
  precoUnitario: 35,
  quantidade: 2,
  variacao: { id: 1, nome: 'Médio', precoAdicional: '0' },
  adicionais: [{ id: 3, nome: 'Morango', precoAdicional: '7.00', quantidade: 1 }],
  observacoes: 'Sem açúcar',
};

function renderCartPage() {
  return render(
    <MemoryRouter>
      <CartProvider>
        <CartPage />
      </CartProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('CartPage', () => {
  it('shows empty cart message', () => {
    renderCartPage();
    expect(screen.getByText('Seu carrinho está vazio.')).toBeTruthy();
    expect(screen.getByText('Ver catálogo').closest('a')?.getAttribute('href')).toBe('/catalogo');
  });

  it('lists items with subtotal and order summary', () => {
    localStorage.setItem(
      'delivery-app:cart',
      JSON.stringify({ items: [itemPizza, itemBolo] }),
    );
    renderCartPage();

    expect(screen.getByText('Pizza Margherita')).toBeTruthy();
    expect(screen.getByText('Bolo de Chocolate')).toBeTruthy();
    expect(screen.getByText('Médio')).toBeTruthy();
    expect(screen.getByText('1× Morango')).toBeTruthy();
    expect(screen.getByText('Obs: Sem açúcar')).toBeTruthy();
    expect(screen.getByText('Subtotal')).toBeTruthy();
    expect(screen.getAllByText('R$ 119,90').length).toBeGreaterThan(0);
    expect(screen.getByText('Finalizar pedido').closest('a')?.getAttribute('href')).toBe(
      '/checkout',
    );
  });

  it('increments quantity and updates totals', () => {
    localStorage.setItem(
      'delivery-app:cart',
      JSON.stringify({ items: [itemPizza] }),
    );
    renderCartPage();

    fireEvent.click(screen.getByLabelText('Aumentar quantidade'));
    expect(screen.getAllByText('R$ 99,80').length).toBeGreaterThan(0);
  });

  it('removes item via remove button', () => {
    localStorage.setItem(
      'delivery-app:cart',
      JSON.stringify({ items: [itemPizza, itemBolo] }),
    );
    renderCartPage();

    fireEvent.click(screen.getAllByLabelText('Remover item')[1]);
    expect(screen.queryByText('Bolo de Chocolate')).toBeNull();
    expect(screen.queryByText('Pizza Margherita')).toBeTruthy();
  });
});