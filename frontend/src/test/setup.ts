// Polyfill completo de localStorage para testes (vitest + jsdom).
// Algumas combinações de vitest 3.x + jsdom não expõem localStorage com
// clear/getItem/setItem/removeItem/key/length como funções utilizáveis.
// Este mock em memória garante comportamento real e homogêneo em todos os testes.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

const memStorage = new MemoryStorage();

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: memStorage,
});

Object.defineProperty(globalThis, "sessionStorage", {
  configurable: true,
  value: memStorage,
});