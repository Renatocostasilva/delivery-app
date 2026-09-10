import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { BottomNav } from './BottomNav';

describe('BottomNav', () => {
  it('renders three navigation items', () => {
    render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>,
    );
    expect(screen.getByText('Início')).toBeTruthy();
    expect(screen.getByText('Catálogo')).toBeTruthy();
    expect(screen.getByText('Buscar')).toBeTruthy();
  });

  it('links to correct routes', () => {
    render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>,
    );
    expect(screen.getByText('Início').closest('a')?.getAttribute('href')).toBe('/');
    expect(screen.getByText('Catálogo').closest('a')?.getAttribute('href')).toBe('/catalogo');
    expect(screen.getByText('Buscar').closest('a')?.getAttribute('href')).toBe('/busca');
  });
});
