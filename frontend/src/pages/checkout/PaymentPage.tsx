import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCheckout } from '../../context/CheckoutContext';
import * as api from '../../api/checkout';
import { ApiError } from '../../api/checkout';
import type { ResultadoCobranca, EstadoPagamento } from '../../api/checkout';
import { formatBRL } from '../../lib/format';

const POLL_INTERVAL_MS = 4000;

const LABELS: Record<EstadoPagamento, string> = {
  INICIADO: 'Aguardando pagamento…',
  PENDENTE: 'Pagamento detectado — confirmando…',
  APROVADO: 'Pagamento aprovado!',
  RECUSADO: 'Pagamento recusado.',
  CANCELADO: 'Pagamento cancelado.',
  EXPIRADO: 'Pagamento expirado.',
  ESTORNADO: 'Pagamento estornado.',
};

const FALHAS: EstadoPagamento[] = ['RECUSADO', 'CANCELADO', 'EXPIRADO'];

export function PaymentPage({ pollMs = POLL_INTERVAL_MS }: { pollMs?: number }) {
  const navigate = useNavigate();
  const { pedidoId } = useParams<{ pedidoId: string }>();
  const { cliente } = useCheckout();

  const id = Number(pedidoId);
  const [cobranca, setCobranca] = useState<ResultadoCobranca | null>(null);
  const [status, setStatus] = useState<EstadoPagamento>('INICIADO');
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(true);
  const [copiado, setCopiado] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const iniciarCobranca = async () => {
    setCriando(true);
    setErro(null);
    setStatus('INICIADO');
    try {
      const resultado = await api.criarCobranca(id, {
        metodo: 'pix',
        email: cliente?.email || undefined,
      });
      setCobranca(resultado);
      setStatus(resultado.pagamento.estadoPagamento);
    } catch (err: unknown) {
      setErro(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : 'Não foi possível gerar a cobrança.',
      );
    } finally {
      setCriando(false);
    }
  };

  useEffect(() => {
    iniciarCobranca();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (FALHAS.includes(status)) return;
    if (status === 'APROVADO') return;

    intervalRef.current = setInterval(() => {
      api
        .consultarPagamento(id, true)
        .then((res) => {
          setStatus(res.pagamento.estadoPagamento);
        })
        .catch(() => {
          // falha de rede: mantém polling — próxima tentativa recupera
        });
    }, pollMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [id, status, pollMs]);

  useEffect(() => {
    if (status === 'APROVADO') {
      navigate(`/pedido/${id}`, { replace: true });
    }
  }, [status, id, navigate]);

  function copiar() {
    if (cobranca?.pagamento.qrCode) {
      navigator.clipboard?.writeText(cobranca.pagamento.qrCode).then(() => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      });
    }
  }

  if (erro && !cobranca) {
    return (
      <div className="payment">
        <h1 className="payment__title">Pagamento</h1>
        <div className="payment__error" role="alert">
          <p>{erro}</p>
          <button type="button" className="checkout-step__btn" onClick={iniciarCobranca}>
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="payment">
      <h1 className="payment__title">Pagamento</h1>

      {cobranca && (
        <div className="payment__info">
          <span className="payment__number">{cobranca.pedido.numeroPedido}</span>
          <span className="payment__total">Total: {formatBRL(cobranca.pedido.total)}</span>
        </div>
      )}

      {criando && <div className="checkout-step__loading" role="status">Gerando cobrança…</div>}

      {!criando && FALHAS.includes(status) && (
        <div className="payment__status payment__status--fail">
          <p>{LABELS[status]}</p>
          <button type="button" className="checkout-step__btn" onClick={iniciarCobranca}>
            Pagar novamente
          </button>
        </div>
      )}

      {cobranca && !criando && !FALHAS.includes(status) && status !== 'APROVADO' && (
        <div className="payment__pix">
          <p className="payment__label">Escaneie o QR Code ou copie o código Pix</p>

          {cobranca.pagamento.qrCodeBase64 && (
            <img
              className="payment__qr"
              src={`data:image/png;base64,${cobranca.pagamento.qrCodeBase64}`}
              alt="QR Code Pix"
            />
          )}

          {cobranca.pagamento.qrCode && (
            <div className="payment__copia-cola">
              <span className="payment__copia-cola-label">Copia-e-cola</span>
              <code className="payment__copia-cola-code" title={cobranca.pagamento.qrCode}>
                {cobranca.pagamento.qrCode}
              </code>
              <button type="button" className="payment__copy-btn" onClick={copiar}>
                {copiado ? 'Copiado!' : 'Copiar código'}
              </button>
            </div>
          )}

          {cobranca.pagamento.expiraEm && (
            <p className="payment__expiry">
              Expira em {new Date(cobranca.pagamento.expiraEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}

          <p className="payment__polling">Aguardando confirmação do pagamento…</p>
        </div>
      )}
    </div>
  );
}