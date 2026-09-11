import { useState } from 'react';

interface ButtonConfirmProps {
  label: string;
  confirmLabel?: string;
  cancelLabel?: string;
  className?: string;
  onConfirm: () => void;
}

export function ButtonConfirm({
  label,
  confirmLabel = 'Confirmar?',
  cancelLabel = 'Cancelar',
  className = 'btn btn--small btn--danger',
  onConfirm,
}: ButtonConfirmProps) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <span className="admin-btn-group">
        <button
          type="button"
          className={className}
          onClick={() => {
            setConfirming(false);
            onConfirm();
          }}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          className="btn btn--small btn--ghost"
          onClick={() => setConfirming(false)}
        >
          {cancelLabel}
        </button>
      </span>
    );
  }

  return (
    <button type="button" className={className} onClick={() => setConfirming(true)}>
      {label}
    </button>
  );
}