import { useParams, Link } from 'react-router-dom';

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="product-detail">
      <Link to="/" className="product-detail__back">
        ← Voltar
      </Link>
      <h1 className="product-detail__title">Produto #{id}</h1>
      <p className="product-detail__stub">Detalhe do produto será implementado futuramente.</p>
    </div>
  );
}
