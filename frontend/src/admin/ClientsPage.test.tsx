import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderAdmin, mockFetchHandler, ok, noContent, seedSession } from './testUtils';

const clientesFixture = {
  data: [
    {
      id: 1,
      nome: 'Ana Souza',
      telefone: '+5511999990000',
      email: 'ana@exemplo.com',
      ativo: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      enderecos: [
        {
          id: 1,
          logradouro: 'Rua A',
          numero: '10',
          complemento: null,
          bairro: 'Centro',
          cidade: 'São Paulo',
          cep: '01001000',
          referencia: null,
          principal: true,
        },
      ],
      _count: { pedidos: 2 },
    },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
};

beforeEach(() => {
  sessionStorage.clear();
});

describe('ClientsPage', () => {
  it('lista clientes com nome, telefone, status e quantidade de pedidos', async () => {
    seedSession();
    mockFetchHandler((url) => {
      if (url.includes('/api/admin/clients')) return ok(clientesFixture);
      return ok({});
    });
    renderAdmin('/admin/clientes');
    await waitFor(() => {
      expect(screen.getByText('Ana Souza')).toBeTruthy();
    });
    expect(screen.getByText('+5511999990000')).toBeTruthy();
    expect(screen.getByText('ana@exemplo.com')).toBeTruthy();
    expect(screen.getAllByText('Ativo')).toHaveLength(1);
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('cria um novo cliente com telefone e endereço', async () => {
    seedSession();
    let body: { telefone?: string; enderecos?: { cep: string }[] } | null = null;
    const created = () => body;
    mockFetchHandler((url, init) => {
      if (init?.method === 'POST' && url.includes('/api/admin/clients')) {
        body = init.body ? JSON.parse(init.body as string) : null;
        return ok({ ...clientesFixture.data[0], id: 2, nome: 'Novo Cliente' });
      }
      if (url.includes('/api/admin/clients')) return ok(clientesFixture);
      return ok({});
    });
    renderAdmin('/admin/clientes');
    await waitFor(() => {
      expect(screen.getByText('Ana Souza')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Nome do cliente'), { target: { value: 'Novo Cliente' } });
    fireEvent.change(screen.getByLabelText('Telefone do cliente'), { target: { value: '11988887777' } });
    fireEvent.change(screen.getByLabelText('E-mail do cliente'), { target: { value: 'novo@exemplo.com' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Adicionar endereço' }));
    fireEvent.change(screen.getByLabelText('Logradouro (endereço 1)'), { target: { value: 'Rua B' } });
    fireEvent.change(screen.getByLabelText('CEP (endereço 1)'), { target: { value: '01234567' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => {
      expect(created()).not.toBeNull();
      expect(created()?.telefone).toBe('11988887777');
      expect(created()?.enderecos?.[0]?.cep).toBe('01234567');
    });
  });

  it('inativa cliente após confirmação', async () => {
    seedSession();
    let deleted = false;
    mockFetchHandler((url, init) => {
      if (init?.method === 'DELETE' && url.includes('/api/admin/clients/')) {
        deleted = true;
        return noContent();
      }
      if (url.includes('/api/admin/clients')) return ok(clientesFixture);
      return ok({});
    });
    renderAdmin('/admin/clientes');
    await waitFor(() => {
      expect(screen.getByText('Ana Souza')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Inativar'));
    fireEvent.click(screen.getByText('Confirmar?'));
    await waitFor(() => {
      expect(deleted).toBe(true);
    });
  });

  it('edita nome e e-mail do cliente via PATCH', async () => {
    seedSession();
    let body: { nome?: string } | null = null;
    const patched = () => body;
    mockFetchHandler((url, init) => {
      if (init?.method === 'PATCH' && url.includes('/api/admin/clients/')) {
        body = init.body ? JSON.parse(init.body as string) : null;
        return ok(clientesFixture.data[0]);
      }
      if (url.includes('/api/admin/clients')) return ok(clientesFixture);
      return ok({});
    });
    renderAdmin('/admin/clientes');
    await waitFor(() => {
      expect(screen.getByText('Ana Souza')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Editar'));
    fireEvent.change(screen.getByLabelText('Nome do cliente (edição)'), { target: { value: 'Ana Nova' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(patched()).not.toBeNull();
      expect(patched()?.nome).toBe('Ana Nova');
    });
  });

  it('adiciona um novo endereço ao editar cliente', async () => {
    seedSession();
    let body: { enderecos?: { id?: number; logradouro?: string; cep?: string }[] } | null = null;
    const patched = () => body;
    mockFetchHandler((url, init) => {
      if (init?.method === 'PATCH' && url.includes('/api/admin/clients/')) {
        body = init.body ? JSON.parse(init.body as string) : null;
        return ok(clientesFixture.data[0]);
      }
      if (url.includes('/api/admin/clients')) return ok(clientesFixture);
      return ok({});
    });
    renderAdmin('/admin/clientes');
    await waitFor(() => {
      expect(screen.getByText('Ana Souza')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Editar'));
    fireEvent.click(screen.getByRole('button', { name: '+ Adicionar endereço (edição)' }));
    fireEvent.change(screen.getByLabelText('Logradouro (endereço 2)'), { target: { value: 'Rua Nova' } });
    fireEvent.change(screen.getByLabelText('Número (endereço 2)'), { target: { value: '99' } });
    fireEvent.change(screen.getByLabelText('Bairro (endereço 2)'), { target: { value: 'Centro' } });
    fireEvent.change(screen.getByLabelText('Cidade (endereço 2)'), { target: { value: 'São Paulo' } });
    fireEvent.change(screen.getByLabelText('CEP (endereço 2)'), { target: { value: '05407000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(patched()).not.toBeNull();
    });
    const novos = patched()?.enderecos?.filter((e) => e.id === undefined) ?? [];
    expect(novos).toHaveLength(1);
    expect(novos[0]?.logradouro).toBe('Rua Nova');
    expect(novos[0]?.cep).toBe('05407000');
  });

  it('remove um endereço existente ao editar cliente', async () => {
    seedSession();
    let body: { enderecos?: { id?: number; remover?: boolean }[] } | null = null;
    const patched = () => body;
    mockFetchHandler((url, init) => {
      if (init?.method === 'PATCH' && url.includes('/api/admin/clients/')) {
        body = init.body ? JSON.parse(init.body as string) : null;
        return ok(clientesFixture.data[0]);
      }
      if (url.includes('/api/admin/clients')) return ok(clientesFixture);
      return ok({});
    });
    renderAdmin('/admin/clientes');
    await waitFor(() => {
      expect(screen.getByText('Ana Souza')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Editar'));
    fireEvent.click(screen.getByRole('button', { name: 'Remover (endereço 1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(patched()).not.toBeNull();
    });
    expect(patched()?.enderecos).toEqual([{ id: 1, remover: true }]);
  });
});