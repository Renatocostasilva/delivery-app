import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createCategory, deleteCategory, getCategories, updateCategory } from '../api';
import type { AdminCategoria, PaginaMeta } from '../types';
import { Pagination } from '../components/Pagination';

const PAGE_SIZE = 20;

interface EditState {
  id: number;
  nome: string;
  ordem: string;
  ativa: boolean;
}

export function CategoriesPage() {
  const [categorias, setCategorias] = useState<AdminCategoria[]>([]);
  const [meta, setMeta] = useState<PaginaMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busca, setBusca] = useState('');
  const [ativa, setAtiva] = useState('todas');
  const [page, setPage] = useState(1);

  const [newNome, setNewNome] = useState('');
  const [newOrdem, setNewOrdem] = useState('0');
  const [newAtiva, setNewAtiva] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [edit, setEdit] = useState<EditState | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getCategories({
      busca: busca || undefined,
      ativa: ativa === 'todas' ? undefined : ativa === 'true',
      page,
      pageSize: PAGE_SIZE,
    })
      .then((res) => {
        setCategorias(res.data);
        setMeta(res.meta);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Erro ao carregar categorias');
      })
      .finally(() => setLoading(false));
  }, [busca, ativa, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await createCategory({
        nome: newNome,
        ordem: newOrdem === '' ? undefined : Number(newOrdem),
        ativa: newAtiva,
      });
      setNewNome('');
      setNewOrdem('0');
      setNewAtiva(true);
      load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Falha ao criar categoria');
    } finally {
      setCreating(false);
    }
  }

  function startEdit(c: AdminCategoria) {
    setEdit({ id: c.id, nome: c.nome, ordem: String(c.ordem), ativa: c.ativa });
  }

  async function handleEditSave(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    try {
      await updateCategory(edit.id, {
        nome: edit.nome,
        ordem: edit.ordem === '' ? undefined : Number(edit.ordem),
        ativa: edit.ativa,
      });
      setEdit(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar categoria');
    }
  }

  async function handleDelete(id: number) {
    setConfirmId(null);
    try {
      const result = await deleteCategory(id);
      if (result && !result.deleted) {
        setError(result.message);
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir categoria');
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page__heading">
        <h1 className="admin-page__title">Categorias</h1>
      </div>

      <form className="admin-panel admin-panel--form" onSubmit={handleCreate}>
        <h2 className="admin-panel__title">Nova categoria</h2>
        <div className="admin-form-row">
          <label className="admin-field">
            <span>Nome *</span>
            <input
              required
              aria-label="Nome da categoria"
              value={newNome}
              onChange={(e) => setNewNome(e.target.value)}
            />
          </label>
          <label className="admin-field">
            <span>Ordem</span>
            <input
              type="number"
              aria-label="Ordem"
              value={newOrdem}
              onChange={(e) => setNewOrdem(e.target.value)}
            />
          </label>
          <label className="admin-check">
            <input
              type="checkbox"
              checked={newAtiva}
              onChange={(e) => setNewAtiva(e.target.checked)}
            />
            <span>Ativa</span>
          </label>
          <button type="submit" className="btn" disabled={creating}>
            Criar
          </button>
        </div>
        {createError && (
          <p className="admin-status admin-status--error">{createError}</p>
        )}
      </form>

      <div className="admin-filter">
        <input
          type="search"
          placeholder="Buscar categoria…"
          aria-label="Buscar categoria"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="Filtrar por status"
          value={ativa}
          onChange={(e) => {
            setAtiva(e.target.value);
            setPage(1);
          }}
        >
          <option value="todas">Ativas e inativas</option>
          <option value="true">Somente ativas</option>
          <option value="false">Somente inativas</option>
        </select>
      </div>

      {loading && <p className="admin-status">Carregando…</p>}
      {error && <p className="admin-status admin-status--error">{error}</p>}

      {!loading && !error && (
        <>
          {categorias.length === 0 ? (
            <p className="admin-muted">Nenhuma categoria encontrada.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Slug</th>
                  <th>Ordem</th>
                  <th>Status</th>
                  <th>Produtos</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {categorias.map((c) =>
                  edit?.id === c.id ? (
                    <tr key={c.id}>
                      <td colSpan={6}>
                        <form className="admin-form-row" onSubmit={handleEditSave}>
                          <input
                            aria-label="Nome da categoria (edição)"
                            value={edit.nome}
                            onChange={(e) => setEdit({ ...edit, nome: e.target.value })}
                          />
                          <input
                            type="number"
                            aria-label="Ordem (edição)"
                            value={edit.ordem}
                            onChange={(e) => setEdit({ ...edit, ordem: e.target.value })}
                          />
                          <label className="admin-check">
                            <input
                              type="checkbox"
                              checked={edit.ativa}
                              onChange={(e) => setEdit({ ...edit, ativa: e.target.checked })}
                            />
                            <span>Ativa</span>
                          </label>
                          <button type="submit" className="btn btn--small">
                            Salvar
                          </button>
                          <button
                            type="button"
                            className="btn btn--small btn--ghost"
                            onClick={() => setEdit(null)}
                          >
                            Cancelar
                          </button>
                        </form>
                      </td>
                    </tr>
                  ) : (
                    <tr key={c.id}>
                      <td>{c.nome}</td>
                      <td>{c.slug}</td>
                      <td>{c.ordem}</td>
                      <td>{c.ativa ? 'Ativa' : 'Inativa'}</td>
                      <td>{c._count.produtos}</td>
                      <td className="admin-actions">
                        <button
                          type="button"
                          className="btn btn--small"
                          onClick={() => startEdit(c)}
                        >
                          Editar
                        </button>
                        {confirmId === c.id ? (
                          <>
                            <button
                              type="button"
                              className="btn btn--small btn--danger"
                              onClick={() => void handleDelete(c.id)}
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
                            onClick={() => setConfirmId(c.id)}
                          >
                            Excluir
                          </button>
                        )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          )}
          <Pagination page={page} totalPages={meta?.totalPages ?? 1} onPage={setPage} />
        </>
      )}
    </div>
  );
}