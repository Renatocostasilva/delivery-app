import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { formatBRL } from '../lib/format';

function QtyStepper({
  value,
  onChange,
  onRemove,
}: {
  value: number;
  onChange: (next: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="cart-stepper">
      <button
        type="button"
        className="cart-stepper__btn"
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
        aria-label="Diminuir quantidade"
      >
        −
      </button>
      <span className="cart-stepper__value">{value}</span>
      <button
        type="button"
        className="cart-stepper__btn"
        onClick={() => onChange(value + 1)}
        aria-label="Aumentar quantidade"
      >
        +
      </button>
      <button
        type="button"
        className="cart-stepper__remove"
        onClick={onRemove}
        aria-label="Remover item"
      >
        Remover
      </button>
    </div>
  );
}

export function CartPage() {
  const { items, subtotal, totalQuantidade, updateQuantity, removeItem } = useCart();

  if (items.length === 0) {
    return (
      <div className="cart">
        <h1 className="cart__title">Carrinho</h1>
        <div className="cart__empty">
          <p>Seu carrinho está vazio.</p>
          <Link to="/catalogo" className="cart__empty-link">
            Ver catálogo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cart">
      <h1 className="cart__title">Carrinho</h1>

      <div className="cart__items">
        {items.map((item) => (
          <div key={item.key} className="cart-item">
            {item.imagem ? (
              <img className="cart-item__img" src={item.imagem} alt={item.produtoNome} />
            ) : (
              <div className="cart-item__placeholder">Sem foto</div>
            )}
            <div className="cart-item__info">
              <span className="cart-item__name">{item.produtoNome}</span>
              {item.variacao && (
                <span className="cart-item__option">{item.variacao.nome}</span>
              )}
              {item.adicionais.length > 0 && (
                <span className="cart-item__options">
                  {item.adicionais
                    .map((a) => `${a.quantidade}× ${a.nome}`)
                    .join(' · ')}
                </span>
              )}
              {item.observacoes && (
                <span className="cart-item__option">Obs: {item.observacoes}</span>
              )}
              <div className="cart-item__row">
                <span className="cart-item__unit">{formatBRL(item.precoUnitario)}</span>
                <span className="cart-item__total">
                  {formatBRL(item.precoUnitario * item.quantidade)}
                </span>
              </div>
              <QtyStepper
                value={item.quantidade}
                onChange={(next) => updateQuantity(item.key, next)}
                onRemove={() => removeItem(item.key)}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="cart__summary">
        <div className="cart__summary-row">
          <span>Itens ({totalQuantidade})</span>
          <span>{formatBRL(subtotal)}</span>
        </div>
        <div className="cart__summary-row">
          <span>Taxa de entrega</span>
          <span>A combinar no checkout</span>
        </div>
        <div className="cart__summary-row cart__summary-row--total">
          <span>Subtotal</span>
          <span>{formatBRL(subtotal)}</span>
        </div>
        <Link to="/checkout" className="cart__checkout">
          Finalizar pedido
        </Link>
        <p className="cart__note">
          Você poderá escolher entre retirada no balcão ou entrega durante o checkout.
        </p>
      </div>
    </div>
  );
}