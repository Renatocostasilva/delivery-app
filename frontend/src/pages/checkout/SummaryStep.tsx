import { useEffect, useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { useCheckout } from '../../context/CheckoutContext';
import { useCart } from '../../context/CartContext';
import * as api from '../../api/checkout';
import { ApiError } from '../../api/checkout';
import type { ResumoPedido } from '../../api/checkout';
import { formatBRL } from '../../lib/format';

export function SummaryStep() {
  const navigate = useNavigate();
  const {
    cartKey,
    cliente,
    tipoEntrega,
    endereco,
    idempotencyKey,
    setPedidoConfirmado,
  } = useCheckout();
  const { clear } = useCart();

  const [resumo, setResumo] = useState<ResumoPedido | null>(null);
  const [observacoes, setObservacoes] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    if (!cartKey || !tipoEntrega) return;
    setCarregando(true);
    setErro(null);
    api
      .resumoPedido(cartKey, tipoEntrega)
      .then(setResumo)
      .catch((err: unknown) => {
        setErro(
          err instanceof ApiError || err instanceof Error
            ? err.message
            : 'Não foi possível carregar o resumo.',
        );
      })
      .finally(() => setCarregando(false));
  }, [cartKey, tipoEntrega]);

  if (!cartKey || !cliente || !tipoEntrega || !idempotencyKey) {
    return <Navigate to="/checkout/identificacao" replace />;
  }

  const cartKeyAtual = cartKey;
  const clienteAtual = cliente;
  const tipoEntregaAtual = tipoEntrega;
  const idempotencyKeyAtual = idempotencyKey;

  function confirmar() {
    setConfirmando(true);
    setErro(null);
    api
      .confirmarPedido({
        cartKey: cartKeyAtual,
        idempotencyKey: idempotencyKeyAtual,
        nome: clienteAtual.nome,
        telefone: clienteAtual.telefone,
        tipoEntrega: tipoEntregaAtual,
        endereco,
        observacoes: observacoes.trim() || null,
      })
      .then((pedido) => {
        setPedidoConfirmado(pedido);
        clear();
        navigate(`/checkout/pagamento/${pedido.id}`);
      })
      .catch((err: unknown) => {
        setErro(
          err instanceof ApiError || err instanceof Error
            ? err.message
            : 'Não foi possível confirmar o pedido.',
        );
      })
      .finally(() => setConfirmando(false));
  }

  if (carregando && !resumo) {
    return <div className="checkout-step__loading" role="status">Carregando resumo…</div>;
  }

  if (erro && !resumo) {
    return (
      <div className="checkout-step__error" role="alert">
        <p>{erro}</p>
        <Link to="/checkout/entrega" className="checkout-step__btn">
          Voltar à entrega
        </Link>
      </div>
    );
  }

  if (!resumo) return null;

  const retirada = tipoEntrega === 'RETIRADA';

  return (
    <div className="checkout-step">
      <h1 className="checkout-step__title">Confirmação</h1>

      {resumo.itensPendentes && (
        <div className="checkout-step__warning" role="alert">
          Existem itens indisponíveis no carrinho. Revise antes de finalizar.
        </div>
      )}

      <div className="checkout-summary__delivery">
        <span className="checkout-summary__delivery-label">Entrega</span>
        <span className="checkout-summary__delivery-value">
          {retirada
            ? 'Retirada no balcão'
            : endereco
              ? `${endereco.logradouro}, ${endereco.numero} — ${endereco.bairro}`
              : 'Entrega no endereço'}
        </span>
      </div>

      <ul className="checkout-summary__items">
        {resumo.itens.map((item) => (
          <li key={item.id} className="checkout-summary__item">
            <span className="checkout-summary__qty">{item.quantidade}×</span>
            <div className="checkout-summary__item-info">
              <span className="checkout-summary__item-name">{item.produtoNome}</span>
              {item.variacaoNome && (
                <span className="checkout-summary__item-option">{item.variacaoNome}</span>
              )}
              {item.adicionais.length > 0 && (
                <span className="checkout-summary__item-options">
                  {item.adicionais
                    .map((a) => `${a.quantidade}× ${a.nome}`)
                    .join(' · ')}
                </span>
              )}
              {item.observacoes && (
                <span className="checkout-summary__item-option">Obs: {item.observacoes}</span>
              )}
              <span className="checkout-summary__item-unit">
                {formatBRL(item.precoUnitario)} cada
              </span>
            </div>
            <span className="checkout-summary__item-total">
              {formatBRL(item.subtotal)}
            </span>
          </li>
        ))}
      </ul>

      <div className="checkout-summary__totals">
        <div className="checkout-summary__row">
          <span>Subtotal</span>
          <span>{formatBRL(resumo.subtotalProdutos)}</span>
        </div>
        <div className="checkout-summary__row">
          <span>Taxa de entrega</span>
          <span>{retirada ? 'Grátis' : formatBRL(resumo.taxaEntrega)}</span>
        </div>
        {Number(resumo.desconto) > 0 && (
          <div className="checkout-summary__row checkout-summary__row--discount">
            <span>Desconto{resumo.cupom ? ` (${resumo.cupom.codigo})` : ''}</span>
            <span>− {formatBRL(resumo.desconto)}</span>
          </div>
        )}
        <div className="checkout-summary__row checkout-summary__row--total">
          <span>Total</span>
          <span>{formatBRL(resumo.total)}</span>
        </div>
      </div>

      <label className="checkout-form__field">
        <span className="checkout-form__label">Observações do pedido</span>
        <textarea
          className="checkout-form__input checkout-form__textarea"
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Ex.: deixar na portaria"
          rows={2}
        />
      </label>

      {erro && <div className="checkout-step__error" role="alert">{erro}</div>}

      <div className="checkout-step__actions">
        <button
          type="button"
          className="checkout-step__btn"
          disabled={confirmando || resumo.itensPendentes}
          onClick={confirmar}
        >
          {confirmando ? 'Confirmando…' : `Confirmar pedido — ${formatBRL(resumo.total)}`}
        </button>
        <Link to="/checkout/entrega" className="checkout-step__back">
          Voltar
        </Link>
      </div>
    </div>
  );
}