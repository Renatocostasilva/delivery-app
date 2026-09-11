import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { useCheckout } from '../../context/CheckoutContext';
import * as api from '../../api/checkout';
import { ApiError } from '../../api/checkout';
import type { EnderecoInput, TipoEntrega } from '../../api/checkout';

function validarEndereco(endereco: EnderecoInput): string | null {
  if (!endereco.logradouro.trim()) return 'Informe o logradouro (rua, avenida…).';
  if (!endereco.numero.trim()) return 'Informe o número.';
  if (!endereco.bairro.trim()) return 'Informe o bairro.';
  if (!endereco.cidade.trim()) return 'Informe a cidade.';
  const cep = endereco.cep.replace(/\D/g, '');
  if (cep.length !== 8) return 'CEP deve ter 8 dígitos.';
  return null;
}

export function DeliveryStep() {
  const navigate = useNavigate();
  const { cartKey, cliente, tipoEntrega, endereco, setEntrega } = useCheckout();

  const [tipo, setTipo] = useState<TipoEntrega>(tipoEntrega ?? 'RETIRADA');
  const [logradouro, setLogradouro] = useState(endereco?.logradouro ?? '');
  const [numero, setNumero] = useState(endereco?.numero ?? '');
  const [complemento, setComplemento] = useState(endereco?.complemento ?? '');
  const [bairro, setBairro] = useState(endereco?.bairro ?? '');
  const [cidade, setCidade] = useState(endereco?.cidade ?? '');
  const [cep, setCep] = useState(endereco?.cep ?? '');
  const [referencia, setReferencia] = useState(endereco?.referencia ?? '');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (!cartKey || !cliente) {
    return <Navigate to="/checkout/identificacao" replace />;
  }
  const cartKeyAtual = cartKey;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);

    const enderecoValue: EnderecoInput | null =
      tipo === 'RETIRADA'
        ? null
        : {
            logradouro: logradouro.trim(),
            numero: numero.trim(),
            complemento: complemento.trim() || null,
            bairro: bairro.trim(),
            cidade: cidade.trim(),
            cep: cep.replace(/\D/g, ''),
            referencia: referencia.trim() || null,
          };

    if (tipo === 'ENTREGA') {
      const valErro = validarEndereco(enderecoValue as EnderecoInput);
      if (valErro) {
        setErro(valErro);
        return;
      }
    }

    setEnviando(true);
    api
      .definirEntrega(cartKeyAtual, tipo, enderecoValue)
      .then(() => {
        setEntrega(tipo, enderecoValue);
        navigate('/checkout/resumo');
      })
      .catch((err: unknown) => {
        setErro(
          err instanceof ApiError || err instanceof Error
            ? err.message
            : 'Não foi possível salvar a entrega.',
        );
      })
      .finally(() => setEnviando(false));
  }

  return (
    <div className="checkout-step">
      <h1 className="checkout-step__title">Entrega</h1>
      <p className="checkout-step__subtitle">Olá, {cliente.nome.split(' ')[0]}! Como quer receber?</p>

      <div className="checkout-radios" role="radiogroup" aria-label="Tipo de entrega">
        <label className={`checkout-radio${tipo === 'RETIRADA' ? ' checkout-radio--active' : ''}`}>
          <input
            type="radio"
            name="tipoEntrega"
            value="RETIRADA"
            checked={tipo === 'RETIRADA'}
            onChange={() => {
              setTipo('RETIRADA');
              setErro(null);
            }}
          />
          <span className="checkout-radio__title">Retirada no balcão</span>
          <span className="checkout-radio__detail">Grátis — você busca no local</span>
        </label>

        <label className={`checkout-radio${tipo === 'ENTREGA' ? ' checkout-radio--active' : ''}`}>
          <input
            type="radio"
            name="tipoEntrega"
            value="ENTREGA"
            checked={tipo === 'ENTREGA'}
            onChange={() => {
              setTipo('ENTREGA');
              setErro(null);
            }}
          />
          <span className="checkout-radio__title">Entrega no endereço</span>
          <span className="checkout-radio__detail">Taxa combinada no resumo</span>
        </label>
      </div>

      {tipo === 'ENTREGA' && (
        <form className="checkout-form checkout-form--address" onSubmit={onSubmit}>
          <label className="checkout-form__field checkout-form__field--wide">
            <span className="checkout-form__label">Logradouro</span>
            <input
              className="checkout-form__input"
              type="text"
              value={logradouro}
              onChange={(e) => setLogradouro(e.target.value)}
              placeholder="Rua, avenida…"
            />
          </label>

          <div className="checkout-form__row">
            <label className="checkout-form__field">
              <span className="checkout-form__label">Número</span>
              <input
                className="checkout-form__input"
                type="text"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="123"
              />
            </label>
            <label className="checkout-form__field">
              <span className="checkout-form__label">Complemento</span>
              <input
                className="checkout-form__input"
                type="text"
                value={complemento}
                onChange={(e) => setComplemento(e.target.value)}
                placeholder="Apto, bloco…"
              />
            </label>
          </div>

          <label className="checkout-form__field">
            <span className="checkout-form__label">Bairro</span>
            <input
              className="checkout-form__input"
              type="text"
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              placeholder="Centro"
            />
          </label>

          <div className="checkout-form__row">
            <label className="checkout-form__field">
              <span className="checkout-form__label">Cidade</span>
              <input
                className="checkout-form__input"
                type="text"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                placeholder="São Paulo"
              />
            </label>
            <label className="checkout-form__field">
              <span className="checkout-form__label">CEP</span>
              <input
                className="checkout-form__input"
                type="text"
                inputMode="numeric"
                value={cep}
                onChange={(e) => setCep(e.target.value)}
                placeholder="00000-000"
              />
            </label>
          </div>

          <label className="checkout-form__field">
            <span className="checkout-form__label">Ponto de referência</span>
            <input
              className="checkout-form__input"
              type="text"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Opcional"
            />
          </label>

          {erro && <div className="checkout-step__error" role="alert">{erro}</div>}

          <div className="checkout-step__actions">
            <button type="submit" className="checkout-step__btn" disabled={enviando}>
              {enviando ? 'Salvando…' : 'Continuar'}
            </button>
            <Link to="/checkout/identificacao" className="checkout-step__back">
              Voltar
            </Link>
          </div>
        </form>
      )}

      {tipo === 'RETIRADA' && (
        <form className="checkout-form" onSubmit={onSubmit}>
          {erro && <div className="checkout-step__error" role="alert">{erro}</div>}
          <div className="checkout-step__actions">
            <button type="submit" className="checkout-step__btn" disabled={enviando}>
              {enviando ? 'Salvando…' : 'Continuar'}
            </button>
            <Link to="/checkout/identificacao" className="checkout-step__back">
              Voltar
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}