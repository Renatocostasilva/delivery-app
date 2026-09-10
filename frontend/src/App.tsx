import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { CatalogPage } from './pages/CatalogPage';
import { CategoryListing } from './pages/CategoryListing';
import { ProductDetail } from './pages/ProductDetail';
import { CartPage } from './pages/CartPage';
import { BottomNav } from './components/BottomNav';
import { SearchPage } from './pages/SearchPage';
import { CartProvider } from './context/CartContext';

export default function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <div className="app">
          <main className="app__main">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/catalogo" element={<CatalogPage />} />
              <Route path="/busca" element={<SearchPage />} />
              <Route path="/carrinho" element={<CartPage />} />
              <Route path="/:categoria/:slug" element={<CategoryListing />} />
              <Route path="/produto/:id" element={<ProductDetail />} />
            </Routes>
          </main>
          <BottomNav />
        </div>
      </CartProvider>
    </BrowserRouter>
  );
}
