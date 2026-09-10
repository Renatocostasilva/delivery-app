import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { CartProvider, useCart, cartItemKey } from './CartContext';
import type { CartItem } from './CartContext';

const itemPizza: CartItem = {
  key: '1::',
  produtoId: 1,
  produtoNome: 'Pizza Margherita',
  precoUnitario: 49.9,
  quantidade: 1,
  variacao: null,
  adicionais: [],
};

const itemBolo: CartItem = {
  key: '2::',
  produtoId: 2,
  produtoNome: 'Bolo de Chocolate',
  precoUnitario: 35,
  quantidade: 1,
  variacao: null,
  adicionais: [],
};

function Probe() {
  const { items, subtotal, totalQuantidade, addItem, updateQuantity, removeItem, clear } =
    useCart();
  return (
    <div>
      <span data-testid="count">{totalQuantidade}</span>
      <span data-testid="items">{items.length}</span>
      <span data-testid="subtotal">{subtotal.toFixed(2)}</span>
      <button onClick={() => addItem(itemPizza)}>add pizza</button>
      <button onClick={() => addItem(itemBolo)}>add bolo</button>
      <button onClick={() => addItem({ ...itemPizza, quantidade: 2 })}>add pizza 2x</button>
      <button onClick={() => updateQuantity(itemPizza.key, 3)}>qty 3</button>
      <button onClick={() => removeItem(itemPizza.key)}>remove pizza</button>
      <button onClick={() => clear()}>clear</button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('CartContext', () => {
  it('starts empty', () => {
    render(
      <CartProvider>
        <Probe />
      </CartProvider>,
    );
    expect(screen.getByTestId('count').textContent).toBe('0');
    expect(screen.getByTestId('subtotal').textContent).toBe('0.00');
  });

  it('adds distinct items and merges same key', () => {
    render(
      <CartProvider>
        <Probe />
      </CartProvider>,
    );
    fireEvent.click(screen.getByText('add pizza'));
    fireEvent.click(screen.getByText('add bolo'));
    fireEvent.click(screen.getByText('add pizza 2x'));

    expect(screen.getByTestId('count').textContent).toBe('4');
    expect(screen.getByTestId('items').textContent).toBe('2');
    expect(screen.getByTestId('subtotal').textContent).toBe('184.70');
  });

  it('updates quantity and recomputes subtotal', () => {
    render(
      <CartProvider>
        <Probe />
      </CartProvider>,
    );
    fireEvent.click(screen.getByText('add pizza'));
    fireEvent.click(screen.getByText('qty 3'));
    expect(screen.getByTestId('count').textContent).toBe('3');
    expect(screen.getByTestId('subtotal').textContent).toBe('149.70');
  });

  it('removes item and clears cart', () => {
    render(
      <CartProvider>
        <Probe />
      </CartProvider>,
    );
    fireEvent.click(screen.getByText('add pizza'));
    fireEvent.click(screen.getByText('add bolo'));
    fireEvent.click(screen.getByText('remove pizza'));
    expect(screen.getByTestId('items').textContent).toBe('1');

    fireEvent.click(screen.getByText('clear'));
    expect(screen.getByTestId('items').textContent).toBe('0');
    expect(screen.getByTestId('subtotal').textContent).toBe('0.00');
  });

  it('persists cart to localStorage', async () => {
    render(
      <CartProvider>
        <Probe />
      </CartProvider>,
    );
    fireEvent.click(screen.getByText('add pizza'));
    await waitFor(() => {
      const raw = localStorage.getItem('delivery-app:cart');
      expect(raw).toBeTruthy();
      expect(JSON.parse(raw ?? '{}').items ?? []).toHaveLength(1);
    });
  });

  it('builds a stable cart item key', () => {
    expect(cartItemKey(1, null, [])).toBe('1::');
    expect(cartItemKey(1, 5, [])).toBe('1:5:');
    expect(cartItemKey(1, 5, [3, 1, 2])).toBe('1:5:1,2,3');
  });
});