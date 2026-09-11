import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCheckout } from '../../context/CheckoutContext';
import * as api from '../../api/checkout';
import { ApiError } from '../../api/checkout';

function apenasDigitos(value: string): string {
  return value.replace(/\D/g, '');
}

function validarTelefone(value: string): string | null {
  const digits = apenasDigitos(value);
  if (digits.length < 10 || digits.length > 11) {
    return 'Informe um telefone com DDD (10 ou 11 dígitos).';
  }
  return null;
}

function validarEmail(value: string): string | null {
  if (!value) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return 'E-mail inválido.';
  }
  return null;
}

export function IdentifyStep() {
  const navigate = useNavigate();
  const {
    iniciarCheckout,
    cartKey,
    cliente,
    setCliente,
  } = useCheckout();

  const [sincronizando, setSincronizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [nome, setNome] = useState(cliente?.nome ?? '');
  const [telefone, setTelefone] = useState(cliente?.telefone ?? '');
  const [email, setEmail] = useState(cliente?.email ?? '');
  const iniciadoRef = useRef(false);

  useEffect(() => {
    if (iniciadoRef.current) return;
    iniciadoRef.current = true;
    setSincronizando(true);
    setErro(null);
    iniciarCheckout()
      .catch((err: unknown) => {
        setErro(
          err instanceof ApiError || err instanceof Error
            ? err.message
            : 'Não foi possível iniciar o checkout.',
        );
      })
      .finally(() => setSincronizando(false));
  }, [iniciarCheckout]);

  function tentarNovamente() {
    iniciadoRef.current = false;
    setSincronizando(true);
    setErro(null);
    iniciarCheckout()
      .catch((err: unknown) => {
        setErro(
          err instanceof ApiError || err instanceof Error
            ? err.message
            : 'Não foi possível iniciar o checkout.',
        );
      })
      .finally(() => setSincronizando(false));
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!cartKey) return;

    const nomeTrim = nome.trim();
    const telefoneErro = validarTelefone(telefone);
    const emailErro = validarEmail(email.trim());

    if (!nomeTrim) {
      setErro('Informe seu nome.');
      return;
    }
    if (telefoneErro) {
      setErro(telefoneErro);
      return;
    }
    if (emailErro) {
      setErro(emailErro);
      return;
    }
    setErro(null);

    api
      .identificarCliente(cartKey, nomeTrim, apenasDigitos(telefone))
      .then(() => {
        setCliente({ nome: nomeTrim, telefone: apenasDigitos(telefone), email: email.trim() });
        navigate('/checkout/entrega');
      })
      .catch((err: unknown) => {
        setErro(
          err instanceof ApiError || err instanceof Error
            ? err.message
            : 'Não foi possível confirmar seus dados.',
        );
      });
  }

  return (
    <div className="checkout-step">
      <h1 className="checkout-step__title">Identificação</h1>
      <p className="checkout-step__subtitle">
        Conte pra gente quem vai receber o pedido.
      </p>

      {sincronizando && (
        <div className="checkout-step__loading" role="status">
          Sincronizando seu carrinho…
        </div>
      )}

      {!sincronizando && !cartKey && (
        <div className="checkout-step__error" role="alert">
          <p>{erro ?? 'Não foi possível iniciar o checkout.'}</p>
          <button
            type="button"
            className="checkout-step__btn"
            onClick={tentarNovamente}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {cartKey && (
        <form className="checkout-form" onSubmit={onSubmit}>
          <label className="checkout-form__field">
            <span className="checkout-form__label">Nome completo</span>
            <input
              className="checkout-form__input"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Maria da Silva"
              autoComplete="name"
            />
          </label>

          <label className="checkout-form__field">
            <span className="checkout-form__label">WhatsApp / telefone</span>
            <input
              className="checkout-form__input"
              type="tel"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="Ex.: (11) 99999-9999"
              autoComplete="tel"
            />
          </label>

          <label className="checkout-form__field">
            <span className="checkout-form__label">E-mail (para o recibo)</span>
            <input
              className="checkout-form__input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ex.: maria@email.com"
              autoComplete="email"
            />
          </label>

          {erro && <div className="checkout-step__error" role="alert">{erro}</div>}

          <button type="submit" className="checkout-step__btn">
            Continuar
          </button>
          <Link to="/carrinho" className="checkout-step__back">
            Voltar ao carrinho
          </Link>
        </form>
      )}
    </div>
  );
}