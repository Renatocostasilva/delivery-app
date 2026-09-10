import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getProducts } from '../api/catalog';
import type { ProdutoCard as ProdutoCardType, PaginaMeta } from '../api/types';
import { ProductCard } from '../components/ProductCard';

const PAGE_SIZE = 12;

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const busca = searchParams.get('q') ?? '';
  const page = Number(searchParams.get('page') ?? '1');

  const [input, setInput] = useState(busca);
  const [produtos, setProdutos] = useState<ProdutoCardType[]>([]);
  const [meta, setMeta] = useState<PaginaMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = useCallback(() => {
    if (!busca.trim()) {
      setProdutos([]);
      setMeta(null);
      return;
    }
    setLoading(true);
    setError(null);
    getProducts({ busca, page, pageSize: PAGE_SIZE })
      .then((res) => {
        setProdutos(res.data);
        setMeta(res.meta);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Erro ao buscar');
      })
      .finally(() => setLoading(false));
  }, [busca, page]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    next.set('q', input.trim());
    next.delete('page');
    setSearchParams(next);
  }

  function goToPage(p: number) {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(p));
    setSearchParams(next);
  }

  return (
    <div className="search">
      <form onSubmit={handleSubmit} className="search__form">
        <input
          type="search"
          className="search__input"
          placeholder="Buscar produtos…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" className="search__btn">
          Buscar
        </button>
      </form>

      {loading && <p className="search__status">Buscando…</p>}
      {error && <p className="search__status search__status--error">{error}</p>}

      {!loading && !error && busca && (
        <>
          {produtos.length === 0 ? (
            <p className="search__status">Nenhum resultado para "{busca}".</p>
          ) : (
            <div className="search__grid">
              {produtos.map((p) => (
                <ProductCard key={p.id} produto={p} />
              ))}
            </div>
          )}

          {meta && meta.totalPages > 1 && (
            <div className="catalog__pagination">
              <button
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
                className="catalog__page-btn"
              >
                Anterior
              </button>
              <span className="catalog__page-info">
                {page} / {meta.totalPages}
              </span>
              <button
                disabled={page >= meta.totalPages}
                onClick={() => goToPage(page + 1)}
                className="catalog__page-btn"
              >
                Próxima
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
