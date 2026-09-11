import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  addProductAdicional,
  addProductImage,
  addProductVariacao,
  createProduct,
  deleteProductAdicional,
  deleteProductImage,
  deleteProductVariacao,
  getCategories,
  getProduct,
  updateProduct,
  updateProductAdicional,
  updateProductImage,
  updateProductVariacao,
} from '../api';
import type { AdminCategoria, AdminProduto } from '../types';
import { ButtonConfirm } from '../components/ButtonConfirm';
import { formatBRL } from '../../lib/format';
import { ADMIN_BASE } from '../constants';

interface FormState {
  nome: string;
  sku: string;
  categoriaId: string;
  subcategoria: string;
  descricaoCurta: string;
  ingredientes: string;
  precoVenda: string;
  precoPromocional: string;
  custo: string;
  margem: string;
  pesoVolume: string;
  dataInicioPromocao: string;
  dataFimPromocao: string;
  ordemExibicao: string;
  estoqueAtual: string;
  estoqueMinimo: string;
  ativo: boolean;
  emDestaque: boolean;
  maisVendido: boolean;
  disponivel: boolean;
  controlarEstoque: boolean;
  vendaSemEstoque: boolean;
  avisoEstoqueBaixo: boolean;
}

const EMPTY_FORM: FormState = {
  nome: '',
  sku: '',
  categoriaId: '',
  subcategoria: '',
  descricaoCurta: '',
  ingredientes: '',
  precoVenda: '',
  precoPromocional: '',
  custo: '',
  margem: '',
  pesoVolume: '',
  dataInicioPromocao: '',
  dataFimPromocao: '',
  ordemExibicao: '0',
  estoqueAtual: '0',
  estoqueMinimo: '0',
  ativo: true,
  emDestaque: false,
  maisVendido: false,
  disponivel: true,
  controlarEstoque: false,
  vendaSemEstoque: false,
  avisoEstoqueBaixo: false,
};

function isoToDatetimeLocal(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 16);
}

function datetimeLocalToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function emptyToNull(value: string): string | null {
  return value.trim() === '' ? null : value;
}

function numOr(value: string, fallback: number): number {
  const n = Number(value);
  return Number.isNaN(n) ? fallback : n;
}

function precoAdicionalOuTracinho(value: string): string {
  const n = parseFloat(value);
  if (Number.isNaN(n) || n === 0 || value === '') return '—';
  return formatBRL(value);
}

function toForm(produto: AdminProduto): FormState {
  return {
    nome: produto.nome,
    sku: produto.sku,
    categoriaId: String(produto.categoriaId ?? ''),
    subcategoria: produto.subcategoria ?? '',
    descricaoCurta: produto.descricaoCurta ?? '',
    ingredientes: produto.ingredientes ?? '',
    precoVenda: produto.precoVenda,
    precoPromocional: produto.precoPromocional ?? '',
    custo: produto.custo ?? '',
    margem: produto.margem ?? '',
    pesoVolume: produto.pesoVolume ?? '',
    dataInicioPromocao: isoToDatetimeLocal(produto.dataInicioPromocao),
    dataFimPromocao: isoToDatetimeLocal(produto.dataFimPromocao),
    ordemExibicao: String(produto.ordemExibicao),
    estoqueAtual: String(produto.estoqueAtual),
    estoqueMinimo: String(produto.estoqueMinimo),
    ativo: produto.ativo,
    emDestaque: produto.emDestaque,
    maisVendido: produto.maisVendido,
    disponivel: produto.disponivel,
    controlarEstoque: produto.controlarEstoque,
    vendaSemEstoque: produto.vendaSemEstoque,
    avisoEstoqueBaixo: produto.avisoEstoqueBaixo,
  };
}

function buildPayload(form: FormState) {
  return {
    nome: form.nome,
    sku: form.sku,
    categoriaId: numOr(form.categoriaId, 0),
    subcategoria: emptyToNull(form.subcategoria),
    descricaoCurta: emptyToNull(form.descricaoCurta),
    ingredientes: emptyToNull(form.ingredientes),
    precoVenda: form.precoVenda,
    precoPromocional: emptyToNull(form.precoPromocional),
    custo: emptyToNull(form.custo),
    margem: emptyToNull(form.margem),
    pesoVolume: emptyToNull(form.pesoVolume),
    dataInicioPromocao: datetimeLocalToIso(form.dataInicioPromocao),
    dataFimPromocao: datetimeLocalToIso(form.dataFimPromocao),
    ordemExibicao: numOr(form.ordemExibicao, 0),
    estoqueAtual: numOr(form.estoqueAtual, 0),
    estoqueMinimo: numOr(form.estoqueMinimo, 0),
    ativo: form.ativo,
    emDestaque: form.emDestaque,
    maisVendido: form.maisVendido,
    disponivel: form.disponivel,
    controlarEstoque: form.controlarEstoque,
    vendaSemEstoque: form.vendaSemEstoque,
    avisoEstoqueBaixo: form.avisoEstoqueBaixo,
  };
}

export function ProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const productId = id ? Number(id) : null;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [produto, setProduto] = useState<AdminProduto | null>(null);
  const [categorias, setCategorias] = useState<AdminCategoria[]>([]);
  const [loading, setLoading] = useState(productId !== null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [imgUrl, setImgUrl] = useState('');
  const [imgPrincipal, setImgPrincipal] = useState(true);
  const [imgBusy, setImgBusy] = useState(false);

  const [varNome, setVarNome] = useState('');
  const [varPreco, setVarPreco] = useState('');
  const [varBusy, setVarBusy] = useState(false);

  const [addNome, setAddNome] = useState('');
  const [addPreco, setAddPreco] = useState('');
  const [addObrigatorio, setAddObrigatorio] = useState(false);
  const [addMin, setAddMin] = useState('0');
  const [addMax, setAddMax] = useState('1');
  const [addBusy, setAddBusy] = useState(false);

  const loadProduct = useCallback(() => {
    if (!productId) return;
    setLoading(true);
    setError(null);
    getProduct(productId)
      .then((p) => {
        setProduto(p);
        setForm(toForm(p));
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Erro ao carregar produto');
      })
      .finally(() => setLoading(false));
  }, [productId]);

  useEffect(() => {
    getCategories({ page: 1, pageSize: 200 })
      .then((res) => setCategorias(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (productId) loadProduct();
  }, [productId, loadProduct]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const payload = buildPayload(form);
      if (productId) {
        await updateProduct(productId, payload);
        setSaved(true);
        loadProduct();
      } else {
        const created = await createProduct(payload);
        navigate(`${ADMIN_BASE}/produtos/${created.id}`, { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar produto');
    } finally {
      setSaving(false);
    }
  }

  async function addImage(e: FormEvent) {
    e.preventDefault();
    if (!productId) return;
    setImgBusy(true);
    setError(null);
    try {
      await addProductImage(productId, {
        url: imgUrl,
        principal: imgPrincipal,
      });
      setImgUrl('');
      setImgPrincipal(false);
      loadProduct();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao adicionar imagem');
    } finally {
      setImgBusy(false);
    }
  }

  async function setPrincipalImage(imageId: number) {
    if (!productId) return;
    setError(null);
    try {
      await updateProductImage(productId, imageId, { principal: true });
      loadProduct();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao definir imagem principal');
    }
  }

  async function removeImage(imageId: number) {
    if (!productId) return;
    setError(null);
    try {
      await deleteProductImage(productId, imageId);
      loadProduct();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover imagem');
    }
  }

  async function addVariacao(e: FormEvent) {
    e.preventDefault();
    if (!productId) return;
    setVarBusy(true);
    setError(null);
    try {
      await addProductVariacao(productId, {
        nome: varNome,
        precoAdicional: varPreco === '' ? undefined : varPreco,
      });
      setVarNome('');
      setVarPreco('');
      loadProduct();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao adicionar variação');
    } finally {
      setVarBusy(false);
    }
  }

  async function toggleVariacao(variacaoId: number, ativo: boolean) {
    if (!productId) return;
    setError(null);
    try {
      await updateProductVariacao(productId, variacaoId, { ativo: !ativo });
      loadProduct();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar variação');
    }
  }

  async function removeVariacao(variacaoId: number) {
    if (!productId) return;
    setError(null);
    try {
      await deleteProductVariacao(productId, variacaoId);
      loadProduct();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover variação');
    }
  }

  async function addAdicional(e: FormEvent) {
    e.preventDefault();
    if (!productId) return;
    setAddBusy(true);
    setError(null);
    try {
      await addProductAdicional(productId, {
        nome: addNome,
        precoAdicional: addPreco === '' ? undefined : addPreco,
        obrigatorio: addObrigatorio,
        quantidadeMinima: numOr(addMin, 0),
        quantidadeMaxima: numOr(addMax, 1),
      });
      setAddNome('');
      setAddPreco('');
      setAddObrigatorio(false);
      setAddMin('0');
      setAddMax('1');
      loadProduct();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao adicionar adicional');
    } finally {
      setAddBusy(false);
    }
  }

  async function removeAdicional(adicionalId: number) {
    if (!productId) return;
    setError(null);
    try {
      await deleteProductAdicional(productId, adicionalId);
      loadProduct();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover adicional');
    }
  }

  async function toggleAdicional(adicionalId: number, ativo: boolean) {
    if (!productId) return;
    setError(null);
    try {
      await updateProductAdicional(productId, adicionalId, { ativo: !ativo });
      loadProduct();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar adicional');
    }
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const isEditing = productId !== null;

  return (
    <div className="admin-page">
      <div className="admin-page__heading">
        <h1 className="admin-page__title">
          {isEditing ? `Editar produto #${productId}` : 'Novo produto'}
        </h1>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => navigate(`${ADMIN_BASE}/produtos`)}
        >
          Voltar
        </button>
      </div>

      {loading && <p className="admin-status">Carregando…</p>}
      {error && <p className="admin-status admin-status--error">{error}</p>}
      {saved && <p className="admin-status admin-status--ok">Produto salvo.</p>}

      {!loading && (
        <>
          <form className="admin-panel admin-panel--form" onSubmit={handleSave}>
            <h2 className="admin-panel__title">Dados básicos</h2>
            <div className="admin-form-grid">
              <label className="admin-field">
                <span>Nome *</span>
                <input
                  required
                  aria-label="Nome"
                  value={form.nome}
                  onChange={(e) => set('nome', e.target.value)}
                />
              </label>
              <label className="admin-field">
                <span>SKU *</span>
                <input
                  required
                  aria-label="SKU"
                  value={form.sku}
                  onChange={(e) => set('sku', e.target.value)}
                />
              </label>
              <label className="admin-field">
                <span>Categoria *</span>
                <select
                  required
                  aria-label="Categoria"
                  value={form.categoriaId}
                  onChange={(e) => set('categoriaId', e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-field">
                <span>Subcategoria</span>
                <input
                  aria-label="Subcategoria"
                  value={form.subcategoria}
                  onChange={(e) => set('subcategoria', e.target.value)}
                />
              </label>
              <label className="admin-field admin-field--wide">
                <span>Descrição curta</span>
                <input
                  aria-label="Descrição curta"
                  value={form.descricaoCurta}
                  onChange={(e) => set('descricaoCurta', e.target.value)}
                />
              </label>
              <label className="admin-field admin-field--wide">
                <span>Ingredientes</span>
                <textarea
                  aria-label="Ingredientes"
                  rows={2}
                  value={form.ingredientes}
                  onChange={(e) => set('ingredientes', e.target.value)}
                />
              </label>
            </div>

            <h3 className="admin-panel__subtitle">Preços</h3>
            <div className="admin-form-grid">
              <label className="admin-field">
                <span>Preço de venda *</span>
                <input
                  required
                  aria-label="Preço de venda"
                  inputMode="decimal"
                  value={form.precoVenda}
                  onChange={(e) => set('precoVenda', e.target.value)}
                />
              </label>
              <label className="admin-field">
                <span>Preço promocional</span>
                <input
                  aria-label="Preço promocional"
                  inputMode="decimal"
                  value={form.precoPromocional}
                  onChange={(e) => set('precoPromocional', e.target.value)}
                />
              </label>
              <label className="admin-field">
                <span>Custo</span>
                <input
                  aria-label="Custo"
                  inputMode="decimal"
                  value={form.custo}
                  onChange={(e) => set('custo', e.target.value)}
                />
              </label>
              <label className="admin-field">
                <span>Margem</span>
                <input
                  aria-label="Margem"
                  inputMode="decimal"
                  value={form.margem}
                  onChange={(e) => set('margem', e.target.value)}
                />
              </label>
            </div>

            <h3 className="admin-panel__subtitle">Estoque e exibição</h3>
            <div className="admin-form-grid">
              <label className="admin-field">
                <span>Peso/volume</span>
                <input
                  aria-label="Peso ou volume"
                  value={form.pesoVolume}
                  onChange={(e) => set('pesoVolume', e.target.value)}
                />
              </label>
              <label className="admin-field">
                <span>Ordem de exibição</span>
                <input
                  type="number"
                  aria-label="Ordem de exibição"
                  value={form.ordemExibicao}
                  onChange={(e) => set('ordemExibicao', e.target.value)}
                />
              </label>
              <label className="admin-field">
                <span>Início da promoção</span>
                <input
                  type="datetime-local"
                  aria-label="Início da promoção"
                  value={form.dataInicioPromocao}
                  onChange={(e) => set('dataInicioPromocao', e.target.value)}
                />
              </label>
              <label className="admin-field">
                <span>Fim da promoção</span>
                <input
                  type="datetime-local"
                  aria-label="Fim da promoção"
                  value={form.dataFimPromocao}
                  onChange={(e) => set('dataFimPromocao', e.target.value)}
                />
              </label>
              {form.controlarEstoque && (
                <>
                  <label className="admin-field">
                    <span>Estoque atual</span>
                    <input
                      type="number"
                      aria-label="Estoque atual"
                      value={form.estoqueAtual}
                      onChange={(e) => set('estoqueAtual', e.target.value)}
                    />
                  </label>
                  <label className="admin-field">
                    <span>Estoque mínimo</span>
                    <input
                      type="number"
                      aria-label="Estoque mínimo"
                      value={form.estoqueMinimo}
                      onChange={(e) => set('estoqueMinimo', e.target.value)}
                    />
                  </label>
                </>
              )}
            </div>

            <div className="admin-checks">
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) => set('ativo', e.target.checked)}
                />
                <span>Ativo (visível)</span>
              </label>
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={form.emDestaque}
                  onChange={(e) => set('emDestaque', e.target.checked)}
                />
                <span>Em destaque</span>
              </label>
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={form.maisVendido}
                  onChange={(e) => set('maisVendido', e.target.checked)}
                />
                <span>Mais vendido</span>
              </label>
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={form.disponivel}
                  onChange={(e) => set('disponivel', e.target.checked)}
                />
                <span>Disponível</span>
              </label>
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={form.controlarEstoque}
                  onChange={(e) => set('controlarEstoque', e.target.checked)}
                />
                <span>Controlar estoque</span>
              </label>
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={form.vendaSemEstoque}
                  onChange={(e) => set('vendaSemEstoque', e.target.checked)}
                />
                <span>Vender sem estoque</span>
              </label>
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={form.avisoEstoqueBaixo}
                  onChange={(e) => set('avisoEstoqueBaixo', e.target.checked)}
                />
                <span>Avisar estoque baixo</span>
              </label>
            </div>

            <div className="admin-form-actions">
              <button type="submit" className="btn" disabled={saving}>
                {saving ? 'Salvando…' : isEditing ? 'Salvar' : 'Criar produto'}
              </button>
            </div>
          </form>

          {isEditing && produto && (
            <>
              <section className="admin-panel">
                <h2 className="admin-panel__title">Imagens</h2>
                {produto.imagens.length === 0 ? (
                  <p className="admin-muted">Nenhuma imagem cadastrada.</p>
                ) : (
                  <ul className="admin-image-list">
                    {produto.imagens.map((img) => (
                      <li key={img.id} className="admin-image-item">
                        <img src={img.url} alt={produto.nome} className="admin-thumb" />
                        <span>
                          {img.principal ? (
                            <strong>Principal</strong>
                          ) : img.url}
                        </span>
                        {!img.principal && (
                          <button
                            type="button"
                            className="btn btn--small btn--ghost"
                            onClick={() => void setPrincipalImage(img.id)}
                          >
                            Definir principal
                          </button>
                        )}
                        <ButtonConfirm label="Remover" onConfirm={() => void removeImage(img.id)} />
                      </li>
                    ))}
                  </ul>
                )}
                <form className="admin-form-row" onSubmit={addImage}>
                  <input
                    placeholder="URL da imagem"
                    aria-label="URL da imagem"
                    value={imgUrl}
                    onChange={(e) => setImgUrl(e.target.value)}
                  />
                  <label className="admin-check">
                    <input
                      type="checkbox"
                      checked={imgPrincipal}
                      onChange={(e) => setImgPrincipal(e.target.checked)}
                    />
                    <span>Principal</span>
                  </label>
                  <button type="submit" className="btn btn--small" disabled={imgBusy || !imgUrl}>
                    Adicionar
                  </button>
                </form>
              </section>

              <section className="admin-panel">
                <h2 className="admin-panel__title">Variações</h2>
                {produto.variacoes && produto.variacoes.length > 0 ? (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Preço adicional</th>
                        <th>Status</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {produto.variacoes.map((v) => (
                        <tr key={v.id}>
                          <td>{v.nome}</td>
                          <td>{precoAdicionalOuTracinho(v.precoAdicional)}</td>
                          <td>{v.ativo ? 'Ativo' : 'Inativo'}</td>
                          <td className="admin-actions">
                            <button
                              type="button"
                              className="btn btn--small btn--ghost"
                              onClick={() => void toggleVariacao(v.id, v.ativo)}
                            >
                              {v.ativo ? 'Inativar' : 'Reativar'}
                            </button>
                            <ButtonConfirm
                              label="Excluir"
                              onConfirm={() => void removeVariacao(v.id)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="admin-muted">Nenhuma variação cadastrada.</p>
                )}
                <form className="admin-form-row" onSubmit={addVariacao}>
                  <input
                    placeholder="Nome da variação (ex.: Grande)"
                    aria-label="Nome da variação"
                    value={varNome}
                    onChange={(e) => setVarNome(e.target.value)}
                  />
                  <input
                    placeholder="Preço adicional"
                    aria-label="Preço adicional da variação"
                    inputMode="decimal"
                    value={varPreco}
                    onChange={(e) => setVarPreco(e.target.value)}
                  />
                  <button type="submit" className="btn btn--small" disabled={varBusy || !varNome}>
                    Adicionar
                  </button>
                </form>
              </section>

              <section className="admin-panel">
                <h2 className="admin-panel__title">Adicionais</h2>
                {produto.adicionais && produto.adicionais.length > 0 ? (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Preço</th>
                        <th>Obrigatório</th>
                        <th>Qtd mín/máx</th>
                        <th>Status</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {produto.adicionais.map((a) => (
                        <tr key={a.id}>
                          <td>{a.nome}</td>
                          <td>{precoAdicionalOuTracinho(a.precoAdicional)}</td>
                          <td>{a.obrigatorio ? 'Sim' : 'Não'}</td>
                          <td>
                            {a.quantidadeMinima} / {a.quantidadeMaxima}
                          </td>
                          <td>{a.ativo ? 'Ativo' : 'Inativo'}</td>
                          <td className="admin-actions">
                            <button
                              type="button"
                              className="btn btn--small btn--ghost"
                              onClick={() => void toggleAdicional(a.id, a.ativo)}
                            >
                              {a.ativo ? 'Inativar' : 'Reativar'}
                            </button>
                            <ButtonConfirm
                              label="Excluir"
                              onConfirm={() => void removeAdicional(a.id)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="admin-muted">Nenhum adicional cadastrado.</p>
                )}
                <form className="admin-form-row" onSubmit={addAdicional}>
                  <input
                    placeholder="Nome do adicional (ex.: Bacon)"
                    aria-label="Nome do adicional"
                    value={addNome}
                    onChange={(e) => setAddNome(e.target.value)}
                  />
                  <input
                    placeholder="Preço"
                    aria-label="Preço do adicional"
                    inputMode="decimal"
                    value={addPreco}
                    onChange={(e) => setAddPreco(e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="Mín"
                    aria-label="Quantidade mínima"
                    value={addMin}
                    onChange={(e) => setAddMin(e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="Máx"
                    aria-label="Quantidade máxima"
                    value={addMax}
                    onChange={(e) => setAddMax(e.target.value)}
                  />
                  <label className="admin-check">
                    <input
                      type="checkbox"
                      checked={addObrigatorio}
                      onChange={(e) => setAddObrigatorio(e.target.checked)}
                    />
                    <span>Obrigatório</span>
                  </label>
                  <button type="submit" className="btn btn--small" disabled={addBusy || !addNome}>
                    Adicionar
                  </button>
                </form>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}