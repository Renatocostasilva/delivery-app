import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { ADMIN_BASE } from './constants';

const NAV_ITEMS = [
  { to: `${ADMIN_BASE}/dashboard`, label: 'Dashboard' },
  { to: `${ADMIN_BASE}/produtos`, label: 'Produtos' },
  { to: `${ADMIN_BASE}/categorias`, label: 'Categorias' },
  { to: `${ADMIN_BASE}/pedidos`, label: 'Pedidos' },
  { to: `${ADMIN_BASE}/clientes`, label: 'Clientes' },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const { admin, logout } = useAuth();

  return (
    <div className="admin">
      <header className="admin__header">
        <strong className="admin__brand">Delivery — Admin</strong>
        <nav className="admin__nav" aria-label="Navegação do admin">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? 'admin__nav-link admin__nav-link--active' : 'admin__nav-link'
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="admin__user">
          <span className="admin__user-name">{admin?.nome}</span>
          <button type="button" className="admin__logout" onClick={() => void logout()}>
            Sair
          </button>
        </div>
      </header>
      <main className="admin__main">{children}</main>
    </div>
  );
}