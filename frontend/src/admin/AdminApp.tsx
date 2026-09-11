import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { AdminLayout } from './AdminLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProductsPage } from './pages/ProductsPage';
import { ProductFormPage } from './pages/ProductFormPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { OrdersPage } from './pages/OrdersPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { ClientsPage } from './pages/ClientsPage';
import { ADMIN_BASE } from './constants';
import './admin.css';

function AdminRoutes() {
  const { admin } = useAuth();

  if (!admin) {
    return <LoginPage />;
  }

  return (
    <AdminLayout>
      <Routes>
        <Route index element={<Navigate to={`${ADMIN_BASE}/dashboard`} replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="produtos" element={<ProductsPage />} />
        <Route path="produtos/novo" element={<ProductFormPage />} />
        <Route path="produtos/:id" element={<ProductFormPage />} />
        <Route path="categorias" element={<CategoriesPage />} />
        <Route path="pedidos" element={<OrdersPage />} />
        <Route path="pedidos/:id" element={<OrderDetailPage />} />
        <Route path="clientes" element={<ClientsPage />} />
        <Route path="*" element={<Navigate to={`${ADMIN_BASE}/dashboard`} replace />} />
      </Routes>
    </AdminLayout>
  );
}

export function AdminApp() {
  return (
    <AuthProvider>
      <AdminRoutes />
    </AuthProvider>
  );
}