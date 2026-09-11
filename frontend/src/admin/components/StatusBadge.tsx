import type { StatusPedido } from '../types';
import { STATUS_LABELS } from '../status';

export function StatusBadge({ status }: { status: StatusPedido }) {
  return (
    <span className={`admin-badge admin-badge--${status.toLowerCase()}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}