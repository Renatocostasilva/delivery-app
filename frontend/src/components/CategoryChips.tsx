import { Link, useSearchParams } from 'react-router-dom';
import type { Categoria } from '../api/types';

interface CategoryChipsProps {
  categorias: Categoria[];
}

export function CategoryChips({ categorias }: CategoryChipsProps) {
  const [searchParams] = useSearchParams();
  const activeCategoria = searchParams.get('categoriaId');

  return (
    <div className="category-chips">
      <Link
        to="/"
        className={`category-chip${!activeCategoria ? ' category-chip--active' : ''}`}
      >
        Todos
      </Link>
      {categorias.map((cat) => (
        <Link
          key={cat.id}
          to={`/catalogo?categoriaId=${cat.id}`}
          className={`category-chip${activeCategoria === String(cat.id) ? ' category-chip--active' : ''}`}
        >
          {cat.nome}
        </Link>
      ))}
    </div>
  );
}
