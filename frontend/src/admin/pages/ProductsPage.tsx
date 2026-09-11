import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteProduct, getCategories, getProducts, updateProduct } from '../api';
import type { AdminCategoria, AdminProduto, PaginaMeta } from '../types';
import { formatBRL } from '../../lib/format';
import { Pagination } from '../components/Pagination';
import { ADMIN_BASE } from '../constants';

const PAGE_SIZE = 12;

type AtivoFilter = 'todos' | 'true' | 'false';

export function ProductsPage() {
  const [produtos, setProdutos] = useState<AdminProduto[]>([]);
  const [categorias, setCategorias] = useState<AdminCategoria[]>([]);
  const [meta, setMeta] = useState<PaginaMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busca, setBusca] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [ativo, setAtivo] = useState<AtivoFilter>('todos');
  const [page, setPage] = useState(1);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getProducts({
      busca: busca || undefined,
      categoriaId: categoriaId ? Number(categoriaId) : undefined,
      ativo: ativo === 'todos' ? undefined : ativo === 'true',
      page,
      pageSize: PAGE_SIZE,
    })
      .then((res) => {
        setProdutos(res.data);
        setMeta(res.meta);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Erro ao carregar produtos');
      })
      .finally(() => setLoading(false));
  }, [busca, categoriaId, ativo, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getCategories({ page: 1, pageSize: 200 })
      .then((res) => setCategorias(res.data))
      .catch(() => {});
  }, []);

  function resetFilters() {
    setBusca('');
    setCategoriaId('');
    setAtivo('todos');
    setPage(1);
  }

  async function handleDelete(id: number) {
    setConfirmId(null);
    try {
      await deleteProduct(id);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Falha ao inativar produto');
    }
  }

  async function handleReactivate(p: AdminProduto) {
    try {
      await updateProduct(p.id, { ativo: true });
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Falha ao reativar produto');
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page__heading">
        <h1 className="admin-page__title">Produtos</h1>
        <Link to={`${ADMIN_BASE}/produtos/novo`} className="btn">
          Novo produto
        </Link>
      </div>

      <div className="admin-filter">
        <input
          type="search"
          placeholder="Buscar por nome ou SKU…"
          aria-label="Buscar produto"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="Filtrar por categoria"
          value={categoriaId}
          onChange={(e) => {
            setCategoriaId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por status"
          value={ativo}
          onChange={(e) => {
            setAtivo(e.target.value as AtivoFilter);
            setPage(1);
          }}
        >
          <option value="todos">Ativos e inativos</option>
          <option value="true">Somente ativos</option>
          <option value="false">Somente inativos</option>
        </select>
        <button type="button" className="btn btn--ghost" onClick={resetFilters}>
          Limpar
        </button>
      </div>

      {loading && <p className="admin-status">Carregando…</p>}
      {error && <p className="admin-status admin-status--error">{error}</p>}

      {!loading && !error && (
        <>
          {produtos.length === 0 ? (
            <p className="admin-muted">Nenhum produto encontrado.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Imagem</th>
                  <th>Nome</th>
                  <th>SKU</th>
                  <th>Categoria</th>
                  <th>Preço</th>
                  <th>Estoque</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {produtos.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.imagens[0] ? (
                        <img
                          src={p.imagens[0].url}
                          alt={p.nome}
                          className="admin-thumb"
                        />
                      ) : (
                        <span className="admin-muted">—</span>
                      )}
                    </td>
                    <td>{p.nome}</td>
                    <td>{p.sku}</td>
                    <td>{p.categoria?.nome ?? '—'}</td>
                    <td>
                      {p.precoPromocional ? (
                        <>
                          <del>{formatBRL(p.precoVenda)}</del>{' '}
                          {formatBRL(p.precoPromocional)}
                        </>
                      ) : (
                        formatBRL(p.precoVenda)
                      )}
                    </td>
                    <td>
                      {p.controlarEstoque ? `${p.estoqueAtual} (mín. ${p.estoqueMinimo})` : '—'}
                    </td>
                    <td>{p.ativo ? 'Ativo' : 'Inativo'}</td>
                    <td className="admin-actions">
                      <Link to={`${ADMIN_BASE}/produtos/${p.id}`} className="btn btn--small">
                        Editar
                      </Link>
                      {p.ativo ? (
                        confirmId === p.id ? (
                          <>
                            <button
                              type="button"
                              className="btn btn--small btn--danger"
                              onClick={() => void handleDelete(p.id)}
                            >
                              Confirmar?
                            </button>
                            <button
                              type="button"
                              className="btn btn--small btn--ghost"
                              onClick={() => setConfirmId(null)}
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn btn--small btn--danger"
                            onClick={() => setConfirmId(p.id)}
                          >
                            Inativar
                          </button>
                        )
                      ) : (
                        <button
                          type="button"
                          className="btn btn--small btn--ghost"
                          onClick={() => void handleReactivate(p)}
                        >
                          Reativar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Pagination page={page} totalPages={meta?.totalPages ?? 1} onPage={setPage} />
        </>
      )}
    </div>
  );
}