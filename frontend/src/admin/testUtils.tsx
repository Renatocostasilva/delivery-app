import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { AdminApp } from './AdminApp';
import type { AdminUser } from './types';

export const SESSION_KEY = 'delivery-admin:session';

export function seedSession(
  admin: AdminUser = { id: 1, email: 'admin@delivery.local', nome: 'Admin Teste' },
) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: 'test-token', admin }));
}

export function renderAdmin(url = '/admin') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
      </Routes>
    </MemoryRouter>,
  );
}

type MockedResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
};

export function mockFetchHandler(handler: (url: string, init?: RequestInit) => MockedResponse | undefined) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL, init?: RequestInit): Promise<MockedResponse> => {
      const result = handler(String(input), init);
      if (result) return result;
      return ok({});
    }),
  );
}

export function ok(body: unknown): MockedResponse {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => body,
  };
}

export function noContent(): MockedResponse {
  return {
    ok: true,
    status: 204,
    statusText: 'No Content',
    json: async () => ({}),
  };
}

export function badRequest(message = 'Requisição inválida'): MockedResponse {
  return {
    ok: false,
    status: 400,
    statusText: 'Bad Request',
    json: async () => ({ message }),
  };
}

export function unauthorized(message = 'Credenciais inválidas'): MockedResponse {
  return {
    ok: false,
    status: 401,
    statusText: 'Unauthorized',
    json: async () => ({ message }),
  };
}

export function conflict(message = 'Transição inválida'): MockedResponse {
  return {
    ok: false,
    status: 409,
    statusText: 'Conflict',
    json: async () => ({ message }),
  };
}