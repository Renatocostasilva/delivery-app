import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getHome } from '../api/catalog';
import type { HomeData } from '../api/types';
import { ProductCard } from '../components/ProductCard';

function Section({
  title,
  link,
  children,
}: {
  title: string;
  link?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="home-section">
      <div className="home-section__header">
        <h2 className="home-section__title">{title}</h2>
        {link && (
          <Link to={link} className="home-section__link">
            Ver todos
          </Link>
        )}
      </div>
      <div className="home-section__grid">{children}</div>
    </section>
  );
}

export function Home() {
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getHome()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro ao carregar');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <p className="home-status">Carregando…</p>;
  if (error) return <p className="home-status home-status--error">{error}</p>;
  if (!data) return null;

  return (
    <div className="home">
      {data.destaques.length > 0 && (
        <Section title="Destaques">
          {data.destaques.map((p) => (
            <ProductCard key={p.id} produto={p} />
          ))}
        </Section>
      )}

      {data.promocoes.length > 0 && (
        <Section title="Promoções">
          {data.promocoes.map((p) => (
            <ProductCard key={p.id} produto={p} />
          ))}
        </Section>
      )}

      {data.maisVendidos.length > 0 && (
        <Section title="Mais Vendidos">
          {data.maisVendidos.map((p) => (
            <ProductCard key={p.id} produto={p} />
          ))}
        </Section>
      )}

      <Section title="Categorias" link="/catalogo">
        <div className="home__categories">
          {data.categorias.map((cat) => (
            <Link key={cat.id} to={`/categoria/${cat.slug}`} className="home__category-card">
              <span>{cat.nome}</span>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}
