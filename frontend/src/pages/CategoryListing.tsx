import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProducts, getCategories } from '../api/catalog';
import type { Categoria, PaginaMeta, ProdutoCard as ProdutoCardType } from '../api/types';
import { ProductCard } from '../components/ProductCard';

const PAGE_SIZE = 12;

export function CategoryListing() {
  const { slug } = useParams<{ categoria: string; slug: string }>();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaAtiva, setCategoriaAtiva] = useState<Categoria | null>(null);
  const [catsLoaded, setCatsLoaded] = useState(false);
  const [produtos, setProdutos] = useState<ProdutoCardType[]>([]);
  const [meta, setMeta] = useState<PaginaMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPage(1);
    getCategories()
      .then((cats) => {
        if (cancelled) return;
        setCategorias(cats);
        setCategoriaAtiva(cats.find((c) => c.slug === slug) ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCatsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!categoriaAtiva) return;
    setLoading(true);
    setError(null);
    getProducts({ categoriaId: categoriaAtiva.id, page, pageSize: PAGE_SIZE })
      .then((res) => {
        setProdutos(res.data);
        setMeta(res.meta);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Erro ao carregar produtos');
      })
      .finally(() => setLoading(false));
  }, [categoriaAtiva, page]);

  if (catsLoaded && !categoriaAtiva) {
    return (
      <div className="catalog">
        <p className="catalog__status">
          Categoria não encontrada.{' '}
          <Link to="/catalogo" className="home-section__link">
            Ver catálogo
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="catalog">
      <div className="category-chips">
        <Link to="/catalogo" className="category-chip">
          Todos
        </Link>
        {categorias.map((cat) => (
          <Link
            key={cat.id}
            to={`/categoria/${cat.slug}`}
            className={`category-chip${cat.id === categoriaAtiva?.id ? ' category-chip--active' : ''}`}
          >
            {cat.nome}
          </Link>
        ))}
      </div>

      <h1 className="category-listing__title">{categoriaAtiva?.nome}</h1>

      {loading && <p className="catalog__status">Carregando…</p>}
      {error && <p className="catalog__status catalog__status--error">{error}</p>}

      {!loading && !error && (
        <>
          {produtos.length === 0 ? (
            <p className="catalog__status">Nenhum produto nesta categoria.</p>
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
                onClick={() => setPage((p) => p - 1)}
                className="catalog__page-btn"
              >
                Anterior
              </button>
              <span className="catalog__page-info">
                {page} / {meta.totalPages}
              </span>
              <button
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
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