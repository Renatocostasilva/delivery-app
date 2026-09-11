import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getClient } from '../api';
import type { ClienteDetalhe } from '../types';
import { formatBRL } from '../../lib/format';
import { formatDateTime } from '../lib/format';
import { StatusBadge } from '../components/StatusBadge';
import { ADMIN_BASE } from '../constants';

export function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const clienteId = Number(id);

  const [detalhe, setDetalhe] = useState<ClienteDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getClient(clienteId)
      .then(setDetalhe)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Erro ao carregar cliente');
      })
      .finally(() => setLoading(false));
  }, [clienteId]);

  if (loading) {
    return <p className="admin-status">Carregando…</p>;
  }

  if (error || !detalhe) {
    return (
      <div className="admin-page">
        <p className="admin-status admin-status--error">{error ?? 'Cliente não encontrado.'}</p>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => navigate(`${ADMIN_BASE}/clientes`)}
        >
          Voltar para clientes
        </button>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-page__heading">
        <h1 className="admin-page__title">
          {detalhe.nome} <span className="admin-muted">{detalhe.ativo ? '· Ativo' : '· Inativo'}</span>
        </h1>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => navigate(`${ADMIN_BASE}/clientes`)}
        >
          Voltar
        </button>
      </div>

      <p className="admin-muted">
        Telefone {detalhe.telefone}
        {detalhe.email ? ` · E-mail ${detalhe.email}` : ''} · cadastrado em{' '}
        {formatDateTime(detalhe.createdAt)}
      </p>

      <div className="admin-grid">
        <section className="admin-panel">
          <h2 className="admin-panel__title">Resumo de compras</h2>
          <p>
            Pedidos: <strong>{detalhe.resumo.totalPedidos}</strong>
          </p>
          <p>
            Total comprado: <strong>{formatBRL(detalhe.resumo.totalComprado)}</strong>
          </p>
          {detalhe.resumo.primeiroPedido && (
            <p className="admin-muted">
              Primeiro pedido:{' '}
              <button
                type="button"
                className="btn btn--link"
                onClick={() => navigate(`${ADMIN_BASE}/pedidos/${detalhe.resumo!.primeiroPedido!.id}`)}
              >
                {detalhe.resumo.primeiroPedido.numeroPedido}
              </button>{' '}
              · {formatBRL(detalhe.resumo.primeiroPedido.total)} ·{' '}
              {formatDateTime(detalhe.resumo.primeiroPedido.createdAt)}
            </p>
          )}
          {detalhe.resumo.ultimoPedido && (
            <p className="admin-muted">
              Último pedido:{' '}
              <button
                type="button"
                className="btn btn--link"
                onClick={() => navigate(`${ADMIN_BASE}/pedidos/${detalhe.resumo!.ultimoPedido!.id}`)}
              >
                {detalhe.resumo.ultimoPedido.numeroPedido}
              </button>{' '}
              · {formatBRL(detalhe.resumo.ultimoPedido.total)} ·{' '}
              {formatDateTime(detalhe.resumo.ultimoPedido.createdAt)}
            </p>
          )}
        </section>

        <section className="admin-panel">
          <h2 className="admin-panel__title">Endereços</h2>
          {detalhe.enderecos.length === 0 ? (
            <p className="admin-muted">Nenhum endereço cadastrado.</p>
          ) : (
            <ul className="admin-list">
              {detalhe.enderecos.map((e) => (
                <li key={e.id} className="admin-list__item">
                  {e.principal ? '⭐ ' : ''}
                  {e.logradouro}, {e.numero}
                  {e.complemento ? ` · ${e.complemento}` : ''} — {e.bairro}, {e.cidade} · CEP{' '}
                  {e.cep}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="admin-panel">
        <h2 className="admin-panel__title">Pedidos ({detalhe.pedidos.length})</h2>
        {detalhe.pedidos.length === 0 ? (
          <p className="admin-muted">Nenhum pedido deste cliente.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Data</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Pagamento</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {detalhe.pedidos.map((p) => (
                <tr
                  key={p.id}
                  className="admin-row--clickable"
                  onClick={() => navigate(`${ADMIN_BASE}/pedidos/${p.id}`)}
                >
                  <td>{p.numeroPedido}</td>
                  <td>{formatDateTime(p.createdAt)}</td>
                  <td>{p.tipoEntrega === 'ENTREGA' ? 'Entrega' : 'Retirada'}</td>
                  <td>
                    <StatusBadge status={p.statusPedido} />
                  </td>
                  <td>{p.statusPagamento}</td>
                  <td>{formatBRL(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}