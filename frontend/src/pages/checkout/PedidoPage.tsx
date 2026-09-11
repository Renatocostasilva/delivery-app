import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCheckout } from '../../context/CheckoutContext';
import * as api from '../../api/checkout';
import { ApiError } from '../../api/checkout';
import type { ResultadoConsulta, StatusPedido } from '../../api/checkout';
import { formatBRL } from '../../lib/format';

export function PedidoPage() {
  const { id } = useParams<{ id: string }>();
  const pedidoId = Number(id);
  const { pedidoConfirmado } = useCheckout();

  const [dados, setDados] = useState<ResultadoConsulta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api
      .consultarPagamento(pedidoId, true)
      .then(setDados)
      .catch((err: unknown) => {
        setErro(
          err instanceof ApiError || err instanceof Error
            ? err.message
            : 'Não foi possível consultar o pedido.',
        );
      })
      .finally(() => setCarregando(false));
  }, [pedidoId]);

  if (carregando && !dados) {
    return <div className="checkout-step__loading" role="status">Consultando seu pedido…</div>;
  }

  if (erro && !dados) {
    return (
      <div className="order">
        <h1 className="order__title">Pedido</h1>
        <div className="payment__error" role="alert">
          <p>{erro}</p>
          <Link to="/" className="checkout-step__btn">Voltar ao início</Link>
        </div>
      </div>
    );
  }

  if (!dados) return null;

  const { pedido, pagamento } = dados;
  const aprovado = pagamento.estadoPagamento === 'APROVADO';
  const aguardando = !aprovado && !['RECUSADO', 'CANCELADO', 'EXPIRADO', 'ESTORNADO'].includes(pagamento.estadoPagamento);
  const tipoEntrega = pedidoConfirmado?.tipoEntrega ?? null;
  const endereco = pedidoConfirmado?.enderecoSnapshot ?? null;
  const criadoEm = new Date(pedido.createdAt).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const statusLabel = (s: StatusPedido | string): string => {
    switch (s) {
      case 'PAGAMENTO_APROVADO':
        return 'Pagamento aprovado';
      case 'AGUARDANDO_PAGAMENTO':
        return 'Aguardando pagamento';
      case 'CANCELADO':
        return 'Cancelado';
      case 'ESTORNADO':
        return 'Estornado';
      case 'RECUSADO':
        return 'Pagamento recusado';
      default:
        return String(s);
    }
  };

  return (
    <div className="order">
      <h1 className="order__title">Seu pedido</h1>

      {aprovado && (
        <div className="order__success" role="status">
          <div className="order__check">✓</div>
          <p className="order__success-title">Pedido confirmado e pago!</p>
          <p className="order__number">{pedido.numeroPedido}</p>
        </div>
      )}

      {aguardando && (
        <div className="order__pending" role="status">
          <p className="order__pending-title">{pagamento.estadoPagamento === 'PENDENTE' ? 'Pagamento em confirmação' : 'Aguardando pagamento'}</p>
          <p className="order__number">{pedido.numeroPedido}</p>
        </div>
      )}

      {!aprovado && !aguardando && (
        <div className="order__failed" role="status">
          <p className="order__failed-title">{statusLabel(pagamento.estadoPagamento)}</p>
          <p className="order__number">{pedido.numeroPedido}</p>
        </div>
      )}

      <dl className="order__details">
        <div className="order__detail">
          <dt>Status</dt>
          <dd>{statusLabel(pedido.statusPedido)}</dd>
        </div>
        <div className="order__detail">
          <dt>Total</dt>
          <dd>{formatBRL(pedido.total)}</dd>
        </div>
        <div className="order__detail">
          <dt>Quando</dt>
          <dd>{criadoEm}</dd>
        </div>
        {tipoEntrega && (
          <div className="order__detail">
            <dt>Entrega</dt>
            <dd>
              {tipoEntrega === 'RETIRADA'
                ? 'Retirada no balcão'
                : endereco
                  ? `${endereco.logradouro}, ${endereco.numero} — ${endereco.bairro}`
                  : 'Entrega no endereço'}
            </dd>
          </div>
        )}
      </dl>

      {aguardando && (
        <Link to={`/checkout/pagamento/${pedidoId}`} className="checkout-step__btn">
          Ver pagamento
        </Link>
      )}

      {!aprovado && !aguardando && (
        <Link to={`/checkout/pagamento/${pedidoId}`} className="checkout-step__btn">
          Tentar pagar novamente
        </Link>
      )}

      <div className="order__actions">
        <Link to="/" className="checkout-step__back">Voltar ao início</Link>
        <Link to="/catalogo" className="checkout-step__back">Fazer novo pedido</Link>
      </div>
    </div>
  );
}