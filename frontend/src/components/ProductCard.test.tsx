import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { ProductCard } from './ProductCard';
import type { ProdutoCard } from '../api/types';

const mockProduto: ProdutoCard = {
  id: 1,
  nome: 'Pizza Margherita',
  categoria: { id: 1, nome: 'Pizzas', slug: 'pizzas' },
  imagens: [{ id: 1, url: 'https://example.com/pizza.jpg', principal: true }],
  precoVenda: '58.90',
  precoPromocional: '49.90',
  disponivel: true,
  emDestaque: true,
  maisVendido: false,
};

describe('ProductCard', () => {
  it('renders product name and category', () => {
    render(
      <MemoryRouter>
        <ProductCard produto={mockProduto} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Pizza Margherita')).toBeTruthy();
    expect(screen.getByText('Pizzas')).toBeTruthy();
  });

  it('displays promotional price when available', () => {
    render(
      <MemoryRouter>
        <ProductCard produto={mockProduto} />
      </MemoryRouter>,
    );
    expect(screen.getByText('R$ 49,90')).toBeTruthy();
  });

  it('displays crossed-out original price on promotion', () => {
    render(
      <MemoryRouter>
        <ProductCard produto={mockProduto} />
      </MemoryRouter>,
    );
    expect(screen.getByText('R$ 58,90')).toBeTruthy();
  });

  it('shows unavailable badge when product is not available', () => {
    const unavailable = { ...mockProduto, disponivel: false };
    render(
      <MemoryRouter>
        <ProductCard produto={unavailable} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Indisponível')).toBeTruthy();
  });

  it('renders image with alt text', () => {
    render(
      <MemoryRouter>
        <ProductCard produto={mockProduto} />
      </MemoryRouter>,
    );
    const img = screen.getByAltText('Pizza Margherita');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('https://example.com/pizza.jpg');
  });

  it('links to product detail page', () => {
    render(
      <MemoryRouter>
        <ProductCard produto={mockProduto} />
      </MemoryRouter>,
    );
    const link = screen.getByText('Pizza Margherita').closest('a');
    expect(link?.getAttribute('href')).toBe('/produto/1');
  });
});
