interface PaginationProps {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}

export function Pagination({ page, totalPages, onPage }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="admin-pagination">
      <button
        type="button"
        className="btn btn--ghost"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Anterior
      </button>
      <span className="admin-pagination__info">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        className="btn btn--ghost"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
      >
        Próxima
      </button>
    </div>
  );
}