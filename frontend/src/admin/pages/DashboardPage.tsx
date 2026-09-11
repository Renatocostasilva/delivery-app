import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDashboard } from '../api';
import type { DashboardData } from '../types';
import { formatBRL } from '../../lib/format';
import { formatDateTime, toIsoDate } from '../lib/format';
import { ORDERED_STATUSES } from '../status';
import { StatusBadge } from '../components/StatusBadge';
import { ADMIN_BASE } from '../constants';

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const load = useCallback((begin?: string, end?: string) => {
    setLoading(true);
    setError(null);
    getDashboard({ dataInicio: begin, dataFim: end })
      .then(setData)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Erro ao carregar dashboard');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function applyFilter() {
    load(toIsoDate(dataInicio), toIsoDate(dataFim));
  }

  function clearFilter() {
    setDataInicio('');
    setDataFim('');
    load();
  }

  return (
    <div className="admin-page">
      <div className="admin-page__heading">
        <h1 className="admin-page__title">Dashboard</h1>
        <div className="admin-filter">
          <input
            type="date"
            aria-label="Data inicial"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />
          <input
            type="date"
            aria-label="Data final"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
          />
          <button type="button" className="btn" onClick={applyFilter}>
            Filtrar
          </button>
          <button type="button" className="btn btn--ghost" onClick={clearFilter}>
            Limpar
          </button>
        </div>
      </div>

      {loading && <p className="admin-status">Carregando…</p>}
      {error && <p className="admin-status admin-status--error">{error}</p>}

      {!loading && !error && data && (
        <>
          <div className="admin-cards">
            <div className="admin-card">
              <span className="admin-card__label">Total de pedidos</span>
              <span className="admin-card__value">{data.resumo.totalPedidos}</span>
            </div>
            <div className="admin-card">
              <span className="admin-card__label">Total de vendas</span>
              <span className="admin-card__value">{formatBRL(data.resumo.totalVendas)}</span>
            </div>
            <div className="admin-card">
              <span className="admin-card__label">Frete</span>
              <span className="admin-card__value">{formatBRL(data.resumo.totalFrete)}</span>
            </div>
            <div className="admin-card">
              <span className="admin-card__label">Descontos</span>
              <span className="admin-card__value">{formatBRL(data.resumo.totalDescontos)}</span>
            </div>
            <div className="admin-card">
              <span className="admin-card__label">Pedidos finalizados</span>
              <span className="admin-card__value">{data.resumo.pedidosFinalizados}</span>
            </div>
            <div className="admin-card">
              <span className="admin-card__label">Ticket médio</span>
              <span className="admin-card__value">{formatBRL(data.resumo.ticketMedio)}</span>
            </div>
          </div>

          <div className="admin-grid">
            <section className="admin-panel">
              <h2 className="admin-panel__title">Pedidos por status</h2>
              <ul className="admin-status-list">
                {ORDERED_STATUSES.filter((s) => (data.pedidosPorStatus[s] ?? 0) > 0).map(
                  (s) => (
                    <li key={s} className="admin-status-list__item">
                      <StatusBadge status={s} />
                      <span className="admin-status-list__count">{data.pedidosPorStatus[s]}</span>
                    </li>
                  ),
                )}
              </ul>
            </section>

            <section className="admin-panel">
              <h2 className="admin-panel__title">Pedidos recentes</h2>
              {data.pedidosRecentes.length === 0 ? (
                <p className="admin-muted">Nenhum pedido no período.</p>
              ) : (
                <ul className="admin-order-list">
                  {data.pedidosRecentes.map((o) => (
                    <li key={o.id}>
                      <Link to={`${ADMIN_BASE}/pedidos/${o.id}`} className="admin-order-list__link">
                        <span className="admin-order-list__numero">{o.numeroPedido}</span>
                        <span className="admin-order-list__cliente">{o.cliente}</span>
                        <StatusBadge status={o.status} />
                        <span className="admin-order-list__total">{formatBRL(o.total)}</span>
                        <span className="admin-order-list__data">{formatDateTime(o.criadoEm)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="admin-panel">
            <h2 className="admin-panel__title">Top produtos</h2>
            {data.topProdutos.length === 0 ? (
              <p className="admin-muted">Nenhum produto vendido no período.</p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Vezes no pedido</th>
                    <th>Quantidade vendida</th>
                    <th>Total vendido</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topProdutos.map((p) => (
                    <tr key={p.nome}>
                      <td>{p.nome}</td>
                      <td>{p.vezesPedido}</td>
                      <td>{p.quantidadeVendida}</td>
                      <td>{formatBRL(p.totalVendido)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}