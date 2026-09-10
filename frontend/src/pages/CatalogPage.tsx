import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getProducts, getCategories } from '../api/catalog';
import type { Categoria, ProdutoCard as ProdutoCardType, PaginaMeta } from '../api/types';
import { ProductCard } from '../components/ProductCard';
import { CategoryChips } from '../components/CategoryChips';

const PAGE_SIZE = 12;

export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoriaId = searchParams.get('categoriaId');
  const page = Number(searchParams.get('page') ?? '1');

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<ProdutoCardType[]>([]);
  const [meta, setMeta] = useState<PaginaMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCategories().then(setCategorias).catch(() => {});
  }, []);

  const loadProducts = useCallback(() => {
    setLoading(true);
    setError(null);
    getProducts({
      categoriaId: categoriaId ? Number(categoriaId) : undefined,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((res) => {
        setProdutos(res.data);
        setMeta(res.meta);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Erro ao carregar produtos');
      })
      .finally(() => setLoading(false));
  }, [categoriaId, page]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  function goToPage(p: number) {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(p));
    setSearchParams(next);
  }

  return (
    <div className="catalog">
      <CategoryChips categorias={categorias} />

      {loading && <p className="catalog__status">Carregando…</p>}
      {error && <p className="catalog__status catalog__status--error">{error}</p>}

      {!loading && !error && (
        <>
          {produtos.length === 0 ? (
            <p className="catalog__status">Nenhum produto encontrado.</p>
          ) : (
            <div className="catalog__grid">
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
