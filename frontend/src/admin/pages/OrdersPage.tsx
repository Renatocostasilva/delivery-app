import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getOrders } from '../api';
import { tipoEntregaLabel } from '../api';
import type { PedidoResumo, StatusPedido } from '../types';
import { formatBRL } from '../../lib/format';
import { formatDateTime, toIsoDate } from '../lib/format';
import { STATUS_LABELS, ORDERED_STATUSES } from '../status';
import { StatusBadge } from '../components/StatusBadge';
import { Pagination } from '../components/Pagination';
import { ADMIN_BASE } from '../constants';

const PAGE_SIZE = 15;

export function OrdersPage() {
  const [pedidos, setPedidos] = useState<PedidoResumo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState('');
  const [busca, setBusca] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getOrders({
      status: status || undefined,
      busca: busca || undefined,
      dataInicio: toIsoDate(dataInicio),
      dataFim: toIsoDate(dataFim),
      page,
      pageSize: PAGE_SIZE,
    })
      .then((res) => {
        setPedidos(res.data);
        setTotal(res.total);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Erro ao carregar pedidos');
      })
      .finally(() => setLoading(false));
  }, [status, busca, dataInicio, dataFim, page]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="admin-page">
      <div className="admin-page__heading">
        <h1 className="admin-page__title">Pedidos</h1>
      </div>

      <div className="admin-filter">
        <input
          type="search"
          placeholder="Buscar por pedido ou cliente…"
          aria-label="Buscar pedido"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="Filtrar por status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos os status</option>
          {ORDERED_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <input
          type="date"
          aria-label="Data inicial"
          value={dataInicio}
          onChange={(e) => {
            setDataInicio(e.target.value);
            setPage(1);
          }}
        />
        <input
          type="date"
          aria-label="Data final"
          value={dataFim}
          onChange={(e) => {
            setDataFim(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {loading && <p className="admin-status">Carregando…</p>}
      {error && <p className="admin-status admin-status--error">{error}</p>}

      {!loading && !error && (
        <>
          {pedidos.length === 0 ? (
            <p className="admin-muted">Nenhum pedido encontrado.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Itens</th>
                  <th>Status</th>
                  <th>Entrega</th>
                  <th>Total</th>
                  <th>Criado em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((o) => (
                  <tr key={o.id}>
                    <td>{o.numeroPedido}</td>
                    <td>{o.cliente?.nome ?? '—'}</td>
                    <td>
                      {o.itens.map((i) => `${i.quantidade}× ${i.produtoNome}`).join('; ') || '—'}
                    </td>
                    <td>
                      <StatusBadge status={o.statusPedido as StatusPedido} />
                    </td>
                    <td>{tipoEntregaLabel(o.tipoEntrega)}</td>
                    <td>{formatBRL(o.total)}</td>
                    <td>{formatDateTime(o.createdAt)}</td>
                    <td>
                      <Link to={`${ADMIN_BASE}/pedidos/${o.id}`} className="btn btn--small">
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </div>
  );
}