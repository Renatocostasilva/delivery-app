import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createClient, deleteClient, getClients, updateClient } from '../api';
import type { ClienteAdmin } from '../types';
import { Pagination } from '../components/Pagination';

const PAGE_SIZE = 20;
const PAGE = 1;

interface NovoEndereco {
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  cep: string;
}

interface EditState {
  id: number;
  nome: string;
  email: string;
  ativo: boolean;
}

function vazio(): NovoEndereco {
  return { logradouro: '', numero: '', bairro: '', cidade: '', cep: '' };
}

export function ClientsPage() {
  const [clientes, setClientes] = useState<ClienteAdmin[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busca, setBusca] = useState('');
  const [ativo, setAtivo] = useState('todas');
  const [page, setPage] = useState(PAGE);

  const [newNome, setNewNome] = useState('');
  const [newTelefone, setNewTelefone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newEnderecos, setNewEnderecos] = useState<NovoEndereco[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [edit, setEdit] = useState<EditState | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getClients({
      busca: busca || undefined,
      ativo: ativo === 'todas' ? undefined : ativo === 'true',
      page,
      pageSize: PAGE_SIZE,
    })
      .then((res) => {
        setClientes(res.data);
        setTotal(res.total);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Erro ao carregar clientes');
      })
      .finally(() => setLoading(false));
  }, [busca, ativo, page]);

  useEffect(() => {
    load();
  }, [load]);

  function atualizarEndereco(index: number, campo: keyof NovoEndereco, valor: string) {
    setNewEnderecos((prev) =>
      prev.map((end, i) => (i === index ? { ...end, [campo]: valor } : end)),
    );
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const enderecos = newEnderecos
        .filter((end) => end.logradouro.trim() !== '' || end.cep.trim() !== '')
        .map((end, index) => ({
          logradouro: end.logradouro,
          numero: end.numero,
          bairro: end.bairro,
          cidade: end.cidade,
          cep: end.cep.replace(/\D/g, ''),
          principal: index === 0,
        }));
      await createClient({
        nome: newNome,
        telefone: newTelefone,
        email: newEmail.trim() === '' ? null : newEmail,
        enderecos: enderecos.length > 0 ? enderecos : undefined,
      });
      setNewNome('');
      setNewTelefone('');
      setNewEmail('');
      setNewEnderecos([]);
      load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Falha ao criar cliente');
    } finally {
      setCreating(false);
    }
  }

  function startEdit(c: ClienteAdmin) {
    setEdit({ id: c.id, nome: c.nome, email: c.email ?? '', ativo: c.ativo });
  }

  async function handleEditSave(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    try {
      await updateClient(edit.id, {
        nome: edit.nome,
        email: edit.email.trim() === '' ? null : edit.email,
        ativo: edit.ativo,
      });
      setEdit(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar cliente');
    }
  }

  async function handleInativar(id: number) {
    setConfirmId(null);
    try {
      await deleteClient(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao inativar cliente');
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="admin-page">
      <div className="admin-page__heading">
        <h1 className="admin-page__title">Clientes</h1>
      </div>

      <form className="admin-panel admin-panel--form" onSubmit={handleCreate}>
        <h2 className="admin-panel__title">Novo cliente</h2>
        <div className="admin-form-row">
          <label className="admin-field">
            <span>Nome *</span>
            <input
              required
              aria-label="Nome do cliente"
              value={newNome}
              onChange={(e) => setNewNome(e.target.value)}
            />
          </label>
          <label className="admin-field">
            <span>Telefone *</span>
            <input
              required
              aria-label="Telefone do cliente"
              value={newTelefone}
              onChange={(e) => setNewTelefone(e.target.value)}
            />
          </label>
          <label className="admin-field">
            <span>E-mail</span>
            <input
              type="email"
              aria-label="E-mail do cliente"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </label>
        </div>

        {newEnderecos.map((end, index) => (
          <div className="admin-form-row" key={index}>
            <label className="admin-field">
              <span>Logradouro</span>
              <input
                aria-label={`Logradouro do endereço ${index + 1}`}
                value={end.logradouro}
                onChange={(e) => atualizarEndereco(index, 'logradouro', e.target.value)}
              />
            </label>
            <label className="admin-field">
              <span>Número</span>
              <input
                aria-label={`Número do endereço ${index + 1}`}
                value={end.numero}
                onChange={(e) => atualizarEndereco(index, 'numero', e.target.value)}
              />
            </label>
            <label className="admin-field">
              <span>Bairro</span>
              <input
                aria-label={`Bairro do endereço ${index + 1}`}
                value={end.bairro}
                onChange={(e) => atualizarEndereco(index, 'bairro', e.target.value)}
              />
            </label>
            <label className="admin-field">
              <span>Cidade</span>
              <input
                aria-label={`Cidade do endereço ${index + 1}`}
                value={end.cidade}
                onChange={(e) => atualizarEndereco(index, 'cidade', e.target.value)}
              />
            </label>
            <label className="admin-field">
              <span>CEP</span>
              <input
                aria-label={`CEP do endereço ${index + 1}`}
                value={end.cep}
                onChange={(e) => atualizarEndereco(index, 'cep', e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn btn--small btn--ghost"
              aria-label={`Remover endereço ${index + 1}`}
              onClick={() => setNewEnderecos((prev) => prev.filter((_, i) => i !== index))}
            >
              Remover
            </button>
          </div>
        ))}

        <div className="admin-form-row">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setNewEnderecos((prev) => [...prev, vazio()])}
          >
            + Adicionar endereço
          </button>
          <button type="submit" className="btn" disabled={creating}>
            Criar
          </button>
        </div>
        {createError && <p className="admin-status admin-status--error">{createError}</p>}
      </form>

      <div className="admin-filter">
        <input
          type="search"
          placeholder="Buscar cliente…"
          aria-label="Buscar cliente"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setPage(PAGE);
          }}
        />
        <select
          aria-label="Filtrar por status"
          value={ativo}
          onChange={(e) => {
            setAtivo(e.target.value);
            setPage(PAGE);
          }}
        >
          <option value="todas">Ativos e inativos</option>
          <option value="true">Somente ativos</option>
          <option value="false">Somente inativos</option>
        </select>
      </div>

      {loading && <p className="admin-status">Carregando…</p>}
      {error && <p className="admin-status admin-status--error">{error}</p>}

      {!loading && !error && (
        <>
          {clientes.length === 0 ? (
            <p className="admin-muted">Nenhum cliente encontrado.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Telefone</th>
                  <th>E-mail</th>
                  <th>Endereços</th>
                  <th>Pedidos</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) =>
                  edit?.id === c.id ? (
                    <tr key={c.id}>
                      <td colSpan={7}>
                        <form className="admin-form-row" onSubmit={handleEditSave}>
                          <input
                            aria-label="Nome do cliente (edição)"
                            value={edit.nome}
                            onChange={(e) => setEdit({ ...edit, nome: e.target.value })}
                          />
                          <input
                            aria-label="E-mail do cliente (edição)"
                            value={edit.email}
                            onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                          />
                          <label className="admin-check">
                            <input
                              type="checkbox"
                              checked={edit.ativo}
                              onChange={(e) => setEdit({ ...edit, ativo: e.target.checked })}
                            />
                            <span>Ativo</span>
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
                      <td>{c.telefone}</td>
                      <td>{c.email ?? '—'}</td>
                      <td>
                        {c.enderecos.length === 0
                          ? '—'
                          : `${c.enderecos.length} (${c.enderecos
                              .map((e) => e.cidade || 'sem cidade')
                              .join(', ')})`}
                      </td>
                      <td>{c._count.pedidos}</td>
                      <td>{c.ativo ? 'Ativo' : 'Inativo'}</td>
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
                              onClick={() => void handleInativar(c.id)}
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
                            Inativar
                          </button>
                        )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          )}
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </div>
  );
}