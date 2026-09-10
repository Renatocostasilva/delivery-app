import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { BottomNav } from './BottomNav';
import { CartProvider } from '../context/CartContext';

function renderWithProviders() {
  return render(
    <MemoryRouter>
      <CartProvider>
        <BottomNav />
      </CartProvider>
    </MemoryRouter>,
  );
}

describe('BottomNav', () => {
  it('renders four navigation items', () => {
    renderWithProviders();
    expect(screen.getByText('Início')).toBeTruthy();
    expect(screen.getByText('Catálogo')).toBeTruthy();
    expect(screen.getByText('Buscar')).toBeTruthy();
    expect(screen.getByText('Carrinho')).toBeTruthy();
  });

  it('links to correct routes', () => {
    renderWithProviders();
    expect(screen.getByText('Início').closest('a')?.getAttribute('href')).toBe('/');
    expect(screen.getByText('Catálogo').closest('a')?.getAttribute('href')).toBe('/catalogo');
    expect(screen.getByText('Buscar').closest('a')?.getAttribute('href')).toBe('/busca');
    expect(screen.getByText('Carrinho').closest('a')?.getAttribute('href')).toBe('/carrinho');
  });

  it('shows no badge when cart is empty', () => {
    renderWithProviders();
    expect(screen.queryByText('0')).toBeNull();
  });
});