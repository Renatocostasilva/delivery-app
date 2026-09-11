import { Outlet, useLocation } from 'react-router-dom';

const STEP_NUMBER: Record<string, number> = {
  '/checkout/identificacao': 1,
  '/checkout/entrega': 2,
  '/checkout/resumo': 3,
};

const STEPS = ['Identificação', 'Entrega', 'Confirmação'];

function stepIndexFor(pathname: string): number {
  const num = STEP_NUMBER[pathname];
  return num ? num - 1 : 0;
}

export function CheckoutFlow() {
  const location = useLocation();
  const active = stepIndexFor(location.pathname);

  return (
    <div className="checkout">
      <div className="checkout__steps" aria-label="Etapas do checkout">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`checkout__step${i === active ? ' checkout__step--active' : ''}${i < active ? ' checkout__step--done' : ''}`}
          >
            <span className="checkout__step-number">{i + 1}</span>
            <span className="checkout__step-label">{label}</span>
          </div>
        ))}
      </div>
      <div className="checkout__body">
        <Outlet />
      </div>
    </div>
  );
}