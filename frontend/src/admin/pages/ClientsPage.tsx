import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient, deleteClient, getClients, updateClient } from '../api';
import type { ClienteAdmin, ClienteEndereco } from '../types';
import { Pagination } from '../components/Pagination';
import { ADMIN_BASE } from '../constants';

const PAGE_SIZE = 20;
const PAGE = 1;

type EnderecoEdicao = {
  id?: number;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  cep: string;
  complemento: string;
  referencia: string;
  principal: boolean;
  removendo: boolean;
};

interface EditState {
  id: number;
  nome: string;
  email: string;
  ativo: boolean;
  enderecos: EnderecoEdicao[];
}

function enderecoVazio(): EnderecoEdicao {
  return {
    logradouro: '',
    numero: '',
    bairro: '',
    cidade: '',
    cep: '',
    complemento: '',
    referencia: '',
    principal: false,
    removendo: false,
  };
}

function daApi(e: ClienteEndereco): EnderecoEdicao {
  return {
    id: e.id,
    logradouro: e.logradouro,
    numero: e.numero,
    bairro: e.bairro,
    cidade: e.cidade,
    cep: e.cep,
    complemento: e.complemento ?? '',
    referencia: e.referencia ?? '',
    principal: e.principal,
    removendo: false,
  };
}

const CAMPOS_NOVO_ENDERECO = ['logradouro', 'numero', 'bairro', 'cidade', 'cep'] as const;

const rotuloEndereco = (campo: string, n: number) => `${campo} (endereço ${n})`;

export function ClientsPage() {
  const navigate = useNavigate();
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
  const [newEnderecos, setNewEnderecos] = useState<EnderecoEdicao[]>([]);
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

  function atualizarNovoEndereco(index: number, campo: keyof EnderecoEdicao, valor: string | boolean) {
    setNewEnderecos((prev) =>
      prev.map((end, i) => (i === index ? { ...end, [campo]: valor } : end)),
    );
  }

  function atualizarEnderecoEditado(index: number, campo: keyof EnderecoEdicao, valor: string | boolean) {
    setEdit((prev) =>
      prev
        ? {
            ...prev,
            enderecos: prev.enderecos.map((end, i) =>
              i === index ? { ...end, [campo]: valor } : end,
            ),
          }
        : prev,
    );
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const enderecos = newEnderecos
        .filter((end) => !(end.removendo || end.logradouro.trim() === '' && end.cep.trim() === ''))
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
    setEdit({
      id: c.id,
      nome: c.nome,
      email: c.email ?? '',
      ativo: c.ativo,
      enderecos: c.enderecos.map(daApi),
    });
  }

  async function handleEditSave(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;

    const enderecoValido = (end: EnderecoEdicao) =>
      CAMPOS_NOVO_ENDERECO.every((campo) => end[campo].trim() !== '');

    const novosIncompletos = edit.enderecos.some(
      (end) => !end.removendo && end.id === undefined && !enderecoValido(end),
    );
    if (novosIncompletos) {
      setError(
        'Para adicionar um novo endereço, preencha logradouro, número, bairro, cidade e CEP.',
      );
      return;
    }

    try {
      const enderecos: Array<{
        id?: number;
        remover?: boolean;
        logradouro?: string;
        numero?: string;
        bairro?: string;
        cidade?: string;
        cep?: string;
        complemento?: string | null;
        referencia?: string | null;
        principal?: boolean;
      }> = [];
      for (const end of edit.enderecos) {
        if (end.removendo) {
          if (end.id !== undefined) enderecos.push({ id: end.id, remover: true });
        } else {
          enderecos.push({
            id: end.id,
            logradouro: end.logradouro,
            numero: end.numero,
            bairro: end.bairro,
            cidade: end.cidade,
            cep: end.cep.replace(/\D/g, ''),
            complemento: end.complemento.trim() === '' ? null : end.complemento,
            referencia: end.referencia.trim() === '' ? null : end.referencia,
            principal: end.principal,
          });
        }
      }
      await updateClient(edit.id, {
        nome: edit.nome,
        email: edit.email.trim() === '' ? null : edit.email,
        ativo: edit.ativo,
        enderecos: enderecos.length > 0 ? enderecos : undefined,
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

  async function handleReativar(id: number) {
    try {
      await updateClient(id, { ativo: true });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao reativar cliente');
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
                aria-label={rotuloEndereco('Logradouro', index + 1)}
                value={end.logradouro}
                onChange={(e) => atualizarNovoEndereco(index, 'logradouro', e.target.value)}
              />
            </label>
            <label className="admin-field">
              <span>Número</span>
              <input
                aria-label={rotuloEndereco('Número', index + 1)}
                value={end.numero}
                onChange={(e) => atualizarNovoEndereco(index, 'numero', e.target.value)}
              />
            </label>
            <label className="admin-field">
              <span>Bairro</span>
              <input
                aria-label={rotuloEndereco('Bairro', index + 1)}
                value={end.bairro}
                onChange={(e) => atualizarNovoEndereco(index, 'bairro', e.target.value)}
              />
            </label>
            <label className="admin-field">
              <span>Cidade</span>
              <input
                aria-label={rotuloEndereco('Cidade', index + 1)}
                value={end.cidade}
                onChange={(e) => atualizarNovoEndereco(index, 'cidade', e.target.value)}
              />
            </label>
            <label className="admin-field">
              <span>CEP</span>
              <input
                aria-label={rotuloEndereco('CEP', index + 1)}
                value={end.cep}
                onChange={(e) => atualizarNovoEndereco(index, 'cep', e.target.value)}
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
            onClick={() => setNewEnderecos((prev) => [...prev, enderecoVazio()])}
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
                        <form className="admin-panel--form" onSubmit={handleEditSave}>
                          <div className="admin-form-row">
                            <label className="admin-field">
                              <span>Nome</span>
                              <input
                                aria-label="Nome do cliente (edição)"
                                value={edit.nome}
                                onChange={(e) => setEdit({ ...edit, nome: e.target.value })}
                              />
                            </label>
                            <label className="admin-field">
                              <span>E-mail</span>
                              <input
                                aria-label="E-mail do cliente (edição)"
                                value={edit.email}
                                onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                              />
                            </label>
                            <label className="admin-check">
                              <input
                                type="checkbox"
                                checked={edit.ativo}
                                onChange={(e) => setEdit({ ...edit, ativo: e.target.checked })}
                              />
                              <span>Ativo</span>
                            </label>
                          </div>

                          <h4 className="admin-panel__subtitle">Endereços</h4>
                          {edit.enderecos.length === 0 && (
                            <p className="admin-muted">Nenhum endereço cadastrado.</p>
                          )}

                          {edit.enderecos.map((end, index) => (
                            <div className="admin-form-row" key={index}>
                              <label className="admin-field">
                                <span>Logradouro</span>
                                <input
                                  aria-label={rotuloEndereco('Logradouro', index + 1)}
                                  value={end.logradouro}
                                  disabled={end.removendo}
                                  onChange={(e) =>
                                    atualizarEnderecoEditado(index, 'logradouro', e.target.value)
                                  }
                                />
                              </label>
                              <label className="admin-field">
                                <span>Número</span>
                                <input
                                  aria-label={rotuloEndereco('Número', index + 1)}
                                  value={end.numero}
                                  disabled={end.removendo}
                                  onChange={(e) =>
                                    atualizarEnderecoEditado(index, 'numero', e.target.value)
                                  }
                                />
                              </label>
                              <label className="admin-field">
                                <span>Bairro</span>
                                <input
                                  aria-label={rotuloEndereco('Bairro', index + 1)}
                                  value={end.bairro}
                                  disabled={end.removendo}
                                  onChange={(e) =>
                                    atualizarEnderecoEditado(index, 'bairro', e.target.value)
                                  }
                                />
                              </label>
                              <label className="admin-field">
                                <span>Cidade</span>
                                <input
                                  aria-label={rotuloEndereco('Cidade', index + 1)}
                                  value={end.cidade}
                                  disabled={end.removendo}
                                  onChange={(e) =>
                                    atualizarEnderecoEditado(index, 'cidade', e.target.value)
                                  }
                                />
                              </label>
                              <label className="admin-field">
                                <span>CEP</span>
                                <input
                                  aria-label={rotuloEndereco('CEP', index + 1)}
                                  value={end.cep}
                                  disabled={end.removendo}
                                  onChange={(e) =>
                                    atualizarEnderecoEditado(index, 'cep', e.target.value)
                                  }
                                />
                              </label>
                              <label className="admin-field">
                                <span>Complemento</span>
                                <input
                                  aria-label={rotuloEndereco('Complemento', index + 1)}
                                  value={end.complemento}
                                  disabled={end.removendo}
                                  onChange={(e) =>
                                    atualizarEnderecoEditado(index, 'complemento', e.target.value)
                                  }
                                />
                              </label>
                              <label className="admin-check">
                                <input
                                  type="checkbox"
                                  checked={end.principal}
                                  disabled={end.removendo}
                                  onChange={(e) =>
                                    atualizarEnderecoEditado(index, 'principal', e.target.checked)
                                  }
                                />
                                <span>Principal</span>
                              </label>
                              {end.id === undefined ? (
                                <button
                                  type="button"
                                  className="btn btn--small btn--ghost"
                                  aria-label={`Remover (endereço ${index + 1})`}
                                  onClick={() =>
                                    setEdit((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            enderecos: prev.enderecos.filter(
                                              (_, i) => i !== index,
                                            ),
                                          }
                                        : prev,
                                    )
                                  }
                                >
                                  Remover
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn--small btn--ghost"
                                  aria-label={`Remover (endereço ${index + 1})`}
                                  onClick={() =>
                                    atualizarEnderecoEditado(index, 'removendo', !end.removendo)
                                  }
                                >
                                  {end.removendo ? 'Restaurar' : 'Remover'}
                                </button>
                              )}
                            </div>
                          ))}
                          {edit.enderecos.some((x) => x.removendo) && (
                            <p className="admin-muted">
                              Endereço marcado para remoção será excluído ao salvar.
                            </p>
                          )}

                          <div className="admin-form-row">
                            <button
                              type="button"
                              className="btn btn--ghost"
                              aria-label="+ Adicionar endereço (edição)"
                              onClick={() =>
                                setEdit((prev) =>
                                  prev ? { ...prev, enderecos: [...prev.enderecos, enderecoVazio()] } : prev,
                                )
                              }
                            >
                              + Adicionar endereço
                            </button>
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
                          </div>
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
                          className="btn btn--small btn--ghost"
                          onClick={() => navigate(`${ADMIN_BASE}/clientes/${c.id}`)}
                        >
                          Ver
                        </button>
                        <button
                          type="button"
                          className="btn btn--small"
                          onClick={() => startEdit(c)}
                        >
                          Editar
                        </button>
                        {c.ativo ? (
                          confirmId === c.id ? (
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
                          )
                        ) : (
                          <button
                            type="button"
                            className="btn btn--small"
                            onClick={() => void handleReativar(c.id)}
                          >
                            Reativar
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