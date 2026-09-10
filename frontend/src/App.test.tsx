import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

describe('App', () => {
  it('renders bottom navigation', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        categorias: [],
        destaques: [],
        maisVendidos: [],
        promocoes: [],
      }),
    });
    render(<App />);
    expect(await screen.findByText('Início')).toBeTruthy();
    expect(screen.getByText('Catálogo')).toBeTruthy();
    expect(screen.getByText('Buscar')).toBeTruthy();
  });
});
