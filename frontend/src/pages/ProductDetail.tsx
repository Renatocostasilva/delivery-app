import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getProductDetail } from '../api/catalog';
import type { ProdutoDetalhe } from '../api/types';
import { useCart, cartItemKey } from '../context/CartContext';
import type { CartItem } from '../context/CartContext';
import { formatBRL } from '../lib/format';

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="stepper">
      <button
        type="button"
        className="stepper__btn"
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        aria-label="Diminuir"
      >
        −
      </button>
      <span className="stepper__value">{value}</span>
      <button
        type="button"
        className="stepper__btn"
        disabled={max > 0 && value >= max}
        onClick={() => onChange(value + 1)}
        aria-label="Aumentar"
      >
        +
      </button>
    </div>
  );
}

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();

  const [produto, setProduto] = useState<ProdutoDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imagemAtiva, setImagemAtiva] = useState(0);
  const [variacaoId, setVariacaoId] = useState<number | null>(null);
  const [adicionalSelection, setAdicionalSelection] = useState<Record<number, number>>({});
  const [quantidade, setQuantidade] = useState(1);
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getProductDetail(id)
      .then((p) => {
        if (cancelled) return;
        setProduto(p);
        const initial: Record<number, number> = {};
        for (const ad of p.adicionais) {
          if (ad.obrigatorio && ad.quantidadeMinima > 0) {
            initial[ad.id] = ad.quantidadeMinima;
          }
        }
        setAdicionalSelection(initial);
        setVariacaoId(p.variacoes.length === 1 ? p.variacoes[0].id : null);
        setImagemAtiva(0);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Erro ao carregar produto');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const selectedVariacao = produto?.variacoes.find((v) => v.id === variacaoId) ?? null;

  const selectedAdicionais = useMemo(() => {
    if (!produto) return [];
    return produto.adicionais
      .filter((a) => (adicionalSelection[a.id] ?? 0) > 0)
      .map((a) => ({
        id: a.id,
        nome: a.nome,
        precoAdicional: a.precoAdicional,
        quantidade: adicionalSelection[a.id] ?? 0,
      }));
  }, [produto, adicionalSelection]);

  const basePrice = useMemo(() => {
    if (!produto) return 0;
    return produto.emPromocao && produto.precoPromocional
      ? parseFloat(produto.precoPromocional)
      : parseFloat(produto.precoVenda);
  }, [produto]);

  const unitPrice = useMemo(() => {
    let total = basePrice;
    if (selectedVariacao) total += parseFloat(selectedVariacao.precoAdicional);
    for (const a of selectedAdicionais) {
      total += parseFloat(a.precoAdicional) * a.quantidade;
    }
    return total;
  }, [basePrice, selectedVariacao, selectedAdicionais]);

  const addonsPendentes =
    produto?.adicionais.filter(
      (a) => a.obrigatorio && (adicionalSelection[a.id] ?? 0) < a.quantidadeMinima,
    ) ?? [];

  const estoqueMaximo =
    produto?.controlarEstoque ? produto.estoqueAtual : 99;

  const podeAdicionar =
    !!produto && produto.disponivel && addonsPendentes.length === 0;

  function handleAdd() {
    if (!produto || !podeAdicionar) return;
    const adicionalIds = selectedAdicionais.map((a) => a.id);
    const item: CartItem = {
      key: cartItemKey(produto.id, selectedVariacao?.id ?? null, adicionalIds),
      produtoId: produto.id,
      produtoNome: produto.nome,
      precoUnitario: unitPrice,
      quantidade,
      imagem: produto.imagens[0]?.url,
      variacao: selectedVariacao
        ? {
            id: selectedVariacao.id,
            nome: selectedVariacao.nome,
            precoAdicional: selectedVariacao.precoAdicional,
          }
        : null,
      adicionais: selectedAdicionais,
      observacoes: observacoes.trim() || undefined,
    };
    addItem(item);
    navigate('/carrinho');
  }

  if (loading) {
    return <p className="product-detail__status">Carregando…</p>;
  }

  if (error || !produto) {
    return (
      <div className="product-detail">
        <Link to="/catalogo" className="product-detail__back">
          ← Voltar
        </Link>
        <p className="product-detail__status product-detail__status--error">
          {error ?? 'Produto não encontrado.'}
        </p>
      </div>
    );
  }

  const imagemPrincipal = produto.imagens[imagemAtiva] ?? produto.imagens[0];
  const temDesconto =
    produto.emPromocao &&
    produto.precoPromocional &&
    parseFloat(produto.precoPromocional) < parseFloat(produto.precoVenda);
  const descricao = produto.descricaoCompleta ?? produto.descricaoCurta;

  return (
    <div className="product-detail">
      <Link to="/catalogo" className="product-detail__back">
        ← Voltar
      </Link>

      <div className="product-detail__gallery">
        {imagemPrincipal ? (
          <img
            className="product-detail__img"
            src={imagemPrincipal.url}
            alt={produto.nome}
          />
        ) : (
          <div className="product-detail__placeholder">Sem foto</div>
        )}
        {produto.imagens.length > 1 && (
          <div className="product-detail__thumbs">
            {produto.imagens.map((img, i) => (
              <button
                key={img.id}
                type="button"
                className={`product-detail__thumb${
                  i === imagemAtiva ? ' product-detail__thumb--active' : ''
                }`}
                onClick={() => setImagemAtiva(i)}
                aria-label={`Imagem ${i + 1}`}
              >
                <img src={img.url} alt={produto.nome} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="product-detail__body">
        <span className="product-detail__category">{produto.categoria.nome}</span>
        <h1 className="product-detail__title">{produto.nome}</h1>

        <div className="product-detail__price">
          {temDesconto && produto.precoPromocional && (
            <span className="product-detail__old-price">
              {formatBRL(produto.precoVenda)}
            </span>
          )}
          <span
            className={`product-detail__current-price${
              temDesconto ? ' product-detail__current-price--promo' : ''
            }`}
          >
            {formatBRL(produto.precoPromocional ?? produto.precoVenda)}
          </span>
        </div>

        {!produto.disponivel && (
          <span className="product-detail__unavailable">Indisponível</span>
        )}

        {produto.controlarEstoque && produto.disponivel && (
          <span className="product-detail__stock">Restam {produto.estoqueAtual}</span>
        )}

        {descricao && <p className="product-detail__description">{descricao}</p>}

        {produto.variacoes.length > 0 && (
          <section className="product-detail__section">
            <h2 className="product-detail__section-title">Escolha a opção</h2>
            <div className="product-detail__variacoes">
              {produto.variacoes.map((variacao) => (
                <button
                  key={variacao.id}
                  type="button"
                  className={`product-detail__variacao${
                    variacao.id === variacaoId
                      ? ' product-detail__variacao--active'
                      : ''
                  }`}
                  onClick={() => setVariacaoId(variacao.id)}
                >
                  <span className="product-detail__variacao-name">{variacao.nome}</span>
                  <span className="product-detail__variacao-price">
                    {parseFloat(variacao.precoAdicional) > 0
                      ? `+ ${formatBRL(variacao.precoAdicional)}`
                      : 'Incluso'}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {produto.adicionais.length > 0 && (
          <section className="product-detail__section">
            <h2 className="product-detail__section-title">Adicionais</h2>
            <div className="product-detail__adicionais">
              {produto.adicionais.map((ad) => (
                <div key={ad.id} className="product-detail__adicional">
                  <div className="product-detail__adicional-info">
                    <span className="product-detail__adicional-nome">
                      {ad.nome}
                      {ad.obrigatorio && (
                        <span className="product-detail__adicional-obrigatorio">
                          {' '}
                          (obrigatório)
                        </span>
                      )}
                    </span>
                    <span className="product-detail__adicional-preco">
                      {parseFloat(ad.precoAdicional) > 0
                        ? `+ ${formatBRL(ad.precoAdicional)}`
                        : 'Grátis'}
                    </span>
                  </div>
                  <Stepper
                    value={adicionalSelection[ad.id] ?? 0}
                    min={ad.obrigatorio ? ad.quantidadeMinima : 0}
                    max={ad.quantidadeMaxima}
                    onChange={(next) =>
                      setAdicionalSelection((prev) => ({ ...prev, [ad.id]: next }))
                    }
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {addonsPendentes.length > 0 && (
          <p className="product-detail__hint">
            {addonsPendentes.map((a) => a.nome).join(', ')} obrigatório(s).
          </p>
        )}

        {produto.ingredientes && (
          <p className="product-detail__extra">
            <strong>Ingredientes:</strong> {produto.ingredientes}
          </p>
        )}
        {produto.pesoVolume && (
          <p className="product-detail__extra">
            <strong>Peso/Volume:</strong> {produto.pesoVolume}
          </p>
        )}
        {produto.observacoesInfo && (
          <p className="product-detail__extra">
            <strong>Observações:</strong> {produto.observacoesInfo}
          </p>
        )}

        <section className="product-detail__section">
          <label className="product-detail__section-title" htmlFor="observacoes">
            Observações
          </label>
          <textarea
            id="observacoes"
            className="product-detail__obs"
            placeholder="Ex.: sem cebola, ponto da carne..."
            rows={3}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </section>
      </div>

      <div className="product-detail__add-bar">
        <div className="product-detail__add-qty">
          <span className="product-detail__add-qty-label">Qtd.</span>
          <Stepper value={quantidade} min={1} max={estoqueMaximo} onChange={setQuantidade} />
        </div>
        <button
          type="button"
          className="product-detail__add-btn"
          disabled={!podeAdicionar}
          onClick={handleAdd}
        >
          Adicionar • {formatBRL(unitPrice * quantidade)}
        </button>
      </div>
    </div>
  );
}