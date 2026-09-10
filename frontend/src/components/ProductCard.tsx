import { Link } from 'react-router-dom';
import type { ProdutoCard as ProdutoCardType } from '../api/types';
import { formatBRL } from '../lib/format';

interface ProductCardProps {
  produto: ProdutoCardType;
}

export function ProductCard({ produto }: ProductCardProps) {
  const imagemPrincipal = produto.imagens.find((i) => i.principal) ?? produto.imagens[0];
  const temDesconto =
    produto.precoPromocional && parseFloat(produto.precoPromocional) < parseFloat(produto.precoVenda);

  return (
    <Link to={`/produto/${produto.id}`} className="product-card">
      {imagemPrincipal ? (
        <img
          className="product-card__img"
          src={imagemPrincipal.url}
          alt={produto.nome}
          loading="lazy"
        />
      ) : (
        <div className="product-card__placeholder">Sem foto</div>
      )}
      <div className="product-card__body">
        <span className="product-card__category">{produto.categoria.nome}</span>
        <h3 className="product-card__name">{produto.nome}</h3>
        <div className="product-card__price">
          {temDesconto && (
            <span className="product-card__old-price">{formatBRL(produto.precoVenda)}</span>
          )}
          <span className={`product-card__price${temDesconto ? ' product-card__price--promo' : ''}`}>
            {formatBRL(produto.precoPromocional ?? produto.precoVenda)}
          </span>
        </div>
        {!produto.disponivel && <span className="product-card__unavailable">Indisponível</span>}
      </div>
    </Link>
  );
}
