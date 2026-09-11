import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { CatalogPage } from './pages/CatalogPage';
import { CategoryListing } from './pages/CategoryListing';
import { ProductDetail } from './pages/ProductDetail';
import { CartPage } from './pages/CartPage';
import { BottomNav } from './components/BottomNav';
import { SearchPage } from './pages/SearchPage';
import { CartProvider } from './context/CartContext';
import { CheckoutProvider } from './context/CheckoutContext';
import { CheckoutFlow } from './pages/checkout/CheckoutFlow';
import { IdentifyStep } from './pages/checkout/IdentifyStep';
import { DeliveryStep } from './pages/checkout/DeliveryStep';
import { SummaryStep } from './pages/checkout/SummaryStep';
import { PaymentPage } from './pages/checkout/PaymentPage';
import { PedidoPage } from './pages/checkout/PedidoPage';

export default function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <CheckoutProvider>
          <div className="app">
            <main className="app__main">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/catalogo" element={<CatalogPage />} />
                <Route path="/busca" element={<SearchPage />} />
                <Route path="/carrinho" element={<CartPage />} />
                <Route path="/checkout" element={<CheckoutFlow />}>
                  <Route index element={<Navigate to="/checkout/identificacao" replace />} />
                  <Route path="identificacao" element={<IdentifyStep />} />
                  <Route path="entrega" element={<DeliveryStep />} />
                  <Route path="resumo" element={<SummaryStep />} />
                </Route>
                <Route path="/checkout/pagamento/:pedidoId" element={<PaymentPage />} />
                <Route path="/pedido/:id" element={<PedidoPage />} />
                <Route path="/:categoria/:slug" element={<CategoryListing />} />
                <Route path="/produto/:id" element={<ProductDetail />} />
              </Routes>
            </main>
            <BottomNav />
          </div>
        </CheckoutProvider>
      </CartProvider>
    </BrowserRouter>
  );
}
