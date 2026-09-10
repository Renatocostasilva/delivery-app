/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import type { ReactNode } from 'react';

const STORAGE_KEY = 'delivery-app:cart';

export interface CartVariacao {
  id: number;
  nome: string;
  precoAdicional: string;
}

export interface CartAdicional {
  id: number;
  nome: string;
  precoAdicional: string;
  quantidade: number;
}

export interface CartItem {
  key: string;
  produtoId: number;
  produtoNome: string;
  precoUnitario: number;
  quantidade: number;
  imagem?: string;
  variacao: CartVariacao | null;
  adicionais: CartAdicional[];
  observacoes?: string;
}

interface CartState {
  items: CartItem[];
}

type CartAction =
  | { type: 'add'; item: CartItem }
  | { type: 'remove'; key: string }
  | { type: 'updateQuantity'; key: string; quantidade: number }
  | { type: 'clear' };

export function cartItemKey(
  produtoId: number,
  variacaoId: number | null,
  adicionalIds: number[],
): string {
  const adicionais = [...adicionalIds].sort((a, b) => a - b).join(',');
  return `${produtoId}:${variacaoId ?? ''}:${adicionais}`;
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      const existing = state.items.find((i) => i.key === action.item.key);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.key === action.item.key
              ? { ...i, quantidade: i.quantidade + action.item.quantidade }
              : i,
          ),
        };
      }
      return { items: [...state.items, action.item] };
    }
    case 'remove':
      return { items: state.items.filter((i) => i.key !== action.key) };
    case 'updateQuantity':
      if (action.quantidade <= 0) {
        return { items: state.items.filter((i) => i.key !== action.key) };
      }
      return {
        items: state.items.map((i) =>
          i.key === action.key ? { ...i, quantidade: action.quantidade } : i,
        ),
      };
    case 'clear':
      return { items: [] };
  }
}

function readInitialState(): CartState {
  if (typeof window === 'undefined') return { items: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { items: [] };
    const parsed = JSON.parse(raw) as CartState;
    if (Array.isArray(parsed?.items)) return parsed;
  } catch {
    // storage inválido ou indisponível: começa vazio
  }
  return { items: [] };
}

interface CartContextValue {
  items: CartItem[];
  totalQuantidade: number;
  subtotal: number;
  addItem: (item: CartItem) => void;
  removeItem: (key: string) => void;
  updateQuantity: (key: string, quantidade: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, undefined, readInitialState);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: state.items }));
    } catch {
      // armazenamento indisponível: carrinho segue só em memória
    }
  }, [state.items]);

  const value = useMemo<CartContextValue>(() => {
    const totalQuantidade = state.items.reduce((sum, i) => sum + i.quantidade, 0);
    const subtotal = state.items.reduce(
      (sum, i) => sum + i.precoUnitario * i.quantidade,
      0,
    );
    return {
      items: state.items,
      totalQuantidade,
      subtotal,
      addItem: (item) => dispatch({ type: 'add', item }),
      removeItem: (key) => dispatch({ type: 'remove', key }),
      updateQuantity: (key, quantidade) =>
        dispatch({ type: 'updateQuantity', key, quantidade }),
      clear: () => dispatch({ type: 'clear' }),
    };
  }, [state.items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart deve ser usado dentro de <CartProvider>');
  }
  return ctx;
}