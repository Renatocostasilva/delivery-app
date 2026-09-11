/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import type { ReactNode } from 'react';
import { useCart } from './CartContext';
import * as api from '../api/checkout';
import { itemParaServidor } from '../api/checkout';
import type {
  EnderecoInput,
  PedidoConfirmado,
  TipoEntrega,
} from '../api/checkout';

const STORAGE_KEY = 'delivery-app:checkout';

export interface CheckoutCliente {
  nome: string;
  telefone: string;
  email?: string;
}

interface CheckoutState {
  cartKey: string | null;
  cliente: CheckoutCliente | null;
  tipoEntrega: TipoEntrega | null;
  endereco: EnderecoInput | null;
  idempotencyKey: string | null;
  pedidoConfirmado: PedidoConfirmado | null;
}

interface CheckoutContextValue extends CheckoutState {
  iniciarCheckout: () => Promise<string>;
  setCliente: (cliente: CheckoutCliente) => void;
  setEntrega: (tipoEntrega: TipoEntrega, endereco: EnderecoInput | null) => void;
  setPedidoConfirmado: (pedido: PedidoConfirmado) => void;
  limpar: () => void;
}

type CheckoutAction =
  | { type: 'iniciado'; cartKey: string; idempotencyKey: string }
  | { type: 'cliente'; cliente: CheckoutCliente }
  | { type: 'entrega'; tipoEntrega: TipoEntrega; endereco: EnderecoInput | null }
  | { type: 'pedido'; pedido: PedidoConfirmado }
  | { type: 'reset' };

const initialState: CheckoutState = {
  cartKey: null,
  cliente: null,
  tipoEntrega: null,
  endereco: null,
  idempotencyKey: null,
  pedidoConfirmado: null,
};

function readInitialState(): CheckoutState {
  if (typeof window === 'undefined') return initialState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as Partial<CheckoutState>;
    return { ...initialState, ...parsed };
  } catch {
    return initialState;
  }
}

function checkoutReducer(
  state: CheckoutState,
  action: CheckoutAction,
): CheckoutState {
  switch (action.type) {
    case 'iniciado':
      return { ...state, cartKey: action.cartKey, idempotencyKey: action.idempotencyKey };
    case 'cliente':
      return { ...state, cliente: action.cliente };
    case 'entrega':
      return { ...state, tipoEntrega: action.tipoEntrega, endereco: action.endereco };
    case 'pedido':
      return { ...state, pedidoConfirmado: action.pedido };
    case 'reset':
      return initialState;
  }
}

function gerarIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const CheckoutContext = createContext<CheckoutContextValue | null>(null);

export function CheckoutProvider({ children }: { children: ReactNode }) {
  const { items } = useCart();
  const [state, dispatch] = useReducer(checkoutReducer, undefined, readInitialState);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // armazenamento indisponível: fluxo segue só em memória
    }
  }, [state]);

  const value = useMemo<CheckoutContextValue>(() => {
    return {
      ...state,
      iniciarCheckout: async () => {
        if (items.length === 0) {
          throw new Error('Seu carrinho está vazio.');
        }
        // Sempre cria um carrinho novo no servidor e sincroniza a partir do
        // carrinho local: garante o estado do servidor bate com o visível
        // ao cliente (e é seguro entre tentativas).
        const { cartKey } = await api.criarCarrinhoServidor();
        for (const item of items) {
          await api.adicionarItemServidor(cartKey, itemParaServidor(item));
        }
        dispatch({
          type: 'iniciado',
          cartKey,
          idempotencyKey: gerarIdempotencyKey(),
        });
        return cartKey;
      },
      setCliente: (cliente) => dispatch({ type: 'cliente', cliente }),
      setEntrega: (tipoEntrega, endereco) =>
        dispatch({ type: 'entrega', tipoEntrega, endereco }),
      setPedidoConfirmado: (pedido) => dispatch({ type: 'pedido', pedido }),
      limpar: () => dispatch({ type: 'reset' }),
    };
  }, [state, items]);

  return <CheckoutContext.Provider value={value}>{children}</CheckoutContext.Provider>;
}

export function useCheckout(): CheckoutContextValue {
  const ctx = useContext(CheckoutContext);
  if (!ctx) {
    throw new Error('useCheckout deve ser usado dentro de <CheckoutProvider>');
  }
  return ctx;
}