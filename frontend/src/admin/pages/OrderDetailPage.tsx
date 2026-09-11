import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { cancelOrder, getOrder, getOrderReceipt, refundOrder, updateOrderStatus } from '../api';
import type { PedidoDetalhe, ReciboPedido, StatusPedido } from '../types';
import { formatBRL } from '../../lib/format';
import { formatDateTime } from '../lib/format';
import { nextStatuses, isTerminalStatus, STATUS_LABELS } from '../status';
import { StatusBadge } from '../components/StatusBadge';
import { ADMIN_BASE } from '../constants';

function adicionaisLabel(item: PedidoDetalhe['itens'][number]): string {
  if (!item.adicionais || item.adicionais.length === 0) return '';
  return item.adicionais
    .map((a) => `${a.nome} (+${formatBRL(a.preco)})`)
    .join(', ');
}

export function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const orderId = Number(id);

  const [detalhe, setDetalhe] = useState<PedidoDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const [statusTarget, setStatusTarget] = useState('');
  const [observacao, setObservacao] = useState('');
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [refundMotivo, setRefundMotivo] = useState('');

  const [receipt, setReceipt] = useState<ReciboPedido | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getOrder(orderId)
      .then(setDetalhe)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Erro ao carregar pedido');
      })
      .finally(() => setLoading(false));
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (detalhe && statusTarget === '') {
      const next = nextStatuses(detalhe.statusPedido);
      setStatusTarget(next.length > 0 ? next[0] : '');
    }
  }, [detalhe, statusTarget]);

  async function run(action: () => Promise<unknown>, successMessage: string) {
    setWorking(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await action();
      setActionSuccess(successMessage);
      await load();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Falha na operação');
    } finally {
      setWorking(false);
    }
  }

  function handleStatusChange() {
    if (!statusTarget) return;
    void run(() =>
      updateOrderStatus(orderId, {
        status: statusTarget,
        observacao: observacao.trim() === '' ? undefined : observacao,
      }),
      `Status atualizado para ${STATUS_LABELS[statusTarget as StatusPedido]}.`,
    );
  }

  function handleCancel() {
    if (cancelMotivo.trim() === '') {
      setActionError('Informe o motivo do cancelamento.');
      return;
    }
    void run(() => cancelOrder(orderId, { motivo: cancelMotivo }), 'Pedido cancelado.');
  }

  function handleRefund() {
    if (refundMotivo.trim() === '') {
      setActionError('Informe o motivo do estorno.');
      return;
    }
    void run(() => refundOrder(orderId, { motivo: refundMotivo }), 'Estorno solicitado.');
  }

  async function handlePrintReceipt() {
    setReceiptOpen(true);
    setReceiptLoading(true);
    setReceiptError(null);
    try {
      const r = await getOrderReceipt(orderId);
      setReceipt(r);
      if (typeof window !== 'undefined' && typeof window.print === 'function') {
        window.print();
      }
    } catch (e: unknown) {
      setReceiptError(e instanceof Error ? e.message : 'Falha ao gerar recibo');
    } finally {
      setReceiptLoading(false);
    }
  }

  if (loading) {
    return <p className="admin-status">Carregando…</p>;
  }
  if (error || !detalhe) {
    return (
      <div className="admin-page">
        <p className="admin-status admin-status--error">{error ?? 'Pedido não encontrado.'}</p>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => navigate(`${ADMIN_BASE}/pedidos`)}
        >
          Voltar para pedidos
        </button>
      </div>
    );
  }

  const terminal = isTerminalStatus(detalhe.statusPedido);
  const next = nextStatuses(detalhe.statusPedido);
  const canRefund = detalhe.statusPagamento === 'APROVADO';

  return (
    <div className="admin-page">
      <div className="admin-page__heading">
        <h1 className="admin-page__title">Pedido {detalhe.numeroPedido}</h1>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => navigate(`${ADMIN_BASE}/pedidos`)}
        >
          Voltar
        </button>
      </div>

      {actionError && <p className="admin-status admin-status--error">{actionError}</p>}
      {actionSuccess && <p className="admin-status admin-status--ok">{actionSuccess}</p>}

      <div className="admin-grid">
        <section className="admin-panel">
          <h2 className="admin-panel__title">Resumo</h2>
          <p>
            <StatusBadge status={detalhe.statusPedido} />{' '}
            <span className="admin-muted">
              Pagamento: {detalhe.statusPagamento}
            </span>
          </p>
          <p>Tipo de entrega: {detalhe.tipoEntrega}</p>
          <p>Total: <strong>{formatBRL(detalhe.total)}</strong></p>
          <p className="admin-muted">
            Subtotal {formatBRL(detalhe.totalProdutos)} · Frete{' '}
            {formatBRL(detalhe.taxasEntrega)} · Desconto {formatBRL(detalhe.desconto)}
          </p>
          {detalhe.formaPagamento && <p>Forma de pagamento: {detalhe.formaPagamento}</p>}
          {detalhe.observacoes && <p>Observações: {detalhe.observacoes}</p>}
        </section>

        <section className="admin-panel">
          <h2 className="admin-panel__title">Cliente</h2>
          <p>{detalhe.cliente.nome}</p>
          <p>Telefone: {detalhe.cliente.telefone}</p>
          {detalhe.cliente.email && <p>E-mail: {detalhe.cliente.email}</p>}
          {detalhe.enderecoSnapshot ? (
            <pre className="admin-pre">{JSON.stringify(detalhe.enderecoSnapshot, null, 2)}</pre>
          ) : (
            <p className="admin-muted">Sem endereço cadastrado (retirada).</p>
          )}
        </section>
      </div>

      <section className="admin-panel">
        <h2 className="admin-panel__title">Itens</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Variação</th>
              <th>Qtd</th>
              <th>Preço unit.</th>
              <th>Adicionais</th>
              <th>Obs.</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {detalhe.itens.map((i) => (
              <tr key={i.id}>
                <td>{i.produtoNome}</td>
                <td>{i.variacaoNome ?? '—'}</td>
                <td>{i.quantidade}</td>
                <td>{formatBRL(i.precoUnitario)}</td>
                <td>{adicionaisLabel(i) || '—'}</td>
                <td>{i.observacoes ?? '—'}</td>
                <td>{formatBRL(i.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="admin-grid">
        <section className="admin-panel">
          <h2 className="admin-panel__title">Pagamentos</h2>
          {detalhe.pagamentos.length === 0 ? (
            <p className="admin-muted">Nenhum pagamento registrado.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Gateway</th>
                  <th>Valor</th>
                  <th>Meio</th>
                  <th>Estado</th>
                  <th>Erro</th>
                </tr>
              </thead>
              <tbody>
                {detalhe.pagamentos.map((p) => (
                  <tr key={p.id}>
                    <td>{p.gateway}</td>
                    <td>{formatBRL(p.valor)}</td>
                    <td>{p.meioPagamento ?? '—'}</td>
                    <td>{p.estadoPagamento}</td>
                    <td>{p.ultimoErroGateway ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="admin-panel">
          <h2 className="admin-panel__title">Histórico de status</h2>
          {detalhe.historico.length === 0 ? (
            <p className="admin-muted">Sem histórico.</p>
          ) : (
            <ul className="admin-timeline">
              {detalhe.historico.map((h, index) => (
                <li key={h.id ?? index} className="admin-timeline__item">
                  <span className="admin-timeline__change">
                    {h.de ? STATUS_LABELS[h.de] : '—'} → {STATUS_LABELS[h.para]}
                  </span>
                  {h.observacao && <p className="admin-muted">{h.observacao}</p>}
                  <span className="admin-timeline__date">{formatDateTime(h.criadoEm)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="admin-panel">
        <h2 className="admin-panel__title">Ações do pedido</h2>

        <div className="admin-action-block">
          <h3 className="admin-panel__subtitle">Alterar status</h3>
          {terminal ? (
            <p className="admin-muted">Status final — nenhuma transição disponível.</p>
          ) : next.length === 0 ? (
            <p className="admin-muted">Nenhuma transição disponível a partir do status atual.</p>
          ) : (
            <>
              <div className="admin-form-row">
                <select
                  aria-label="Novo status"
                  value={statusTarget}
                  onChange={(e) => setStatusTarget(e.target.value)}
                >
                  {next.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Observação (opcional)"
                  aria-label="Observação do status"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                />
                <button
                  type="button"
                  className="btn"
                  disabled={working || !statusTarget}
                  onClick={handleStatusChange}
                >
                  Atualizar status
                </button>
              </div>
            </>
          )}
        </div>

        <div className="admin-action-block">
          <h3 className="admin-panel__subtitle">Cancelar pedido</h3>
          {terminal ? (
            <p className="admin-muted">Pedido em status final — não é possível cancelar.</p>
          ) : (
            <div className="admin-form-row">
              <input
                placeholder="Motivo do cancelamento"
                aria-label="Motivo do cancelamento"
                value={cancelMotivo}
                onChange={(e) => setCancelMotivo(e.target.value)}
              />
              <button
                type="button"
                className="btn btn--danger"
                disabled={working}
                onClick={handleCancel}
              >
                Cancelar pedido
              </button>
            </div>
          )}
        </div>

        <div className="admin-action-block">
          <h3 className="admin-panel__subtitle">Estornar pagamento</h3>
          {canRefund ? (
            <div className="admin-form-row">
              <input
                placeholder="Motivo do estorno"
                aria-label="Motivo do estorno"
                value={refundMotivo}
                onChange={(e) => setRefundMotivo(e.target.value)}
              />
              <button
                type="button"
                className="btn btn--danger"
                disabled={working}
                onClick={handleRefund}
              >
                Estornar
              </button>
            </div>
          ) : (
            <p className="admin-muted">
              Estorno disponível apenas com pagamento aprovado. Status atual:{' '}
              {detalhe.statusPagamento}
            </p>
          )}
        </div>

        <div className="admin-action-block">
          <h3 className="admin-panel__subtitle">Imprimir recibo</h3>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={receiptLoading}
            onClick={() => void handlePrintReceipt()}
          >
            {receiptLoading ? 'Gerando…' : 'Imprimir recibo'}
          </button>

          {receiptOpen && receiptError && (
            <p className="admin-status admin-status--error">{receiptError}</p>
          )}
          {receiptOpen && receipt && (
            <div className="admin-receipt" aria-label="Recibo do pedido">
              <h3>Recibo — {receipt.numeroPedido}</h3>
              <p>
                Cliente: {receipt.cliente.nome} · {receipt.cliente.telefone}
                {receipt.cliente.email ? ` · ${receipt.cliente.email}` : ''}
              </p>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Variação</th>
                    <th>Qtd</th>
                    <th>Preço</th>
                    <th>Adicionais</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {receipt.itens.map((item, index) => (
                    <tr key={index}>
                      <td>{item.nome}</td>
                      <td>{item.variacao ?? '—'}</td>
                      <td>{item.quantidade}</td>
                      <td>{formatBRL(item.precoUnitario)}</td>
                      <td>
                        {item.adicionais && item.adicionais.length > 0
                          ? item.adicionais
                              .map((a) => `${a.nome} (+${formatBRL(a.preco)})`)
                              .join(', ')
                          : '—'}
                      </td>
                      <td>{formatBRL(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                Subtotal {formatBRL(receipt.subtotal)} · Frete {formatBRL(receipt.taxaEntrega)} ·
                Desconto {formatBRL(receipt.desconto)} ·{' '}
                <strong>Total {formatBRL(receipt.total)}</strong>
              </p>
              {receipt.formaPagamento && <p>Pagamento: {receipt.formaPagamento}</p>}
              {receipt.observacoes && <p>Obs.: {receipt.observacoes}</p>}
              <button
                type="button"
                className="btn btn--small"
                onClick={() => {
                  if (typeof window !== 'undefined' && typeof window.print === 'function') {
                    window.print();
                  }
                }}
              >
                Imprimir
              </button>
            </div>
          )}
        </div>

        <div className="admin-action-block">
          <h3 className="admin-panel__subtitle">Exclusão</h3>
          <button
            type="button"
            className="btn btn--small btn--ghost"
            disabled
            title="TODO: o backend ainda não expõe DELETE /api/admin/orders"
          >
            Excluir pedido — TODO
          </button>
        </div>
      </section>
    </div>
  );
}