import type { StatusPedido } from './types';

export const STATUS_LABELS: Record<StatusPedido, string> = {
  RECEBIDO: 'Recebido',
  AGUARDANDO_PAGAMENTO: 'Aguardando pagamento',
  PAGAMENTO_APROVADO: 'Pagamento aprovado',
  EM_PREPARACAO: 'Em preparação',
  PRONTO: 'Pronto',
  SAIU_PARA_ENTREGA: 'Saiu para entrega',
  ENTREGUE: 'Entregue',
  CANCELADO: 'Cancelado',
  RECUSADO: 'Recusado',
  FALHA_PAGAMENTO: 'Falha no pagamento',
  ESTORNADO: 'Estornado',
};

export const ORDERED_STATUSES: StatusPedido[] = [
  'RECEBIDO',
  'AGUARDANDO_PAGAMENTO',
  'PAGAMENTO_APROVADO',
  'EM_PREPARACAO',
  'PRONTO',
  'SAIU_PARA_ENTREGA',
  'ENTREGUE',
  'CANCELADO',
  'RECUSADO',
  'FALHA_PAGAMENTO',
  'ESTORNADO',
];

export const NEXT_STATUS_TRANSITIONS: Partial<
  Record<StatusPedido, StatusPedido[]>
> = {
  RECEBIDO: ['PAGAMENTO_APROVADO', 'EM_PREPARACAO', 'CANCELADO'],
  AGUARDANDO_PAGAMENTO: ['PAGAMENTO_APROVADO', 'CANCELADO', 'RECUSADO', 'FALHA_PAGAMENTO'],
  PAGAMENTO_APROVADO: ['EM_PREPARACAO', 'CANCELADO'],
  EM_PREPARACAO: ['PRONTO', 'CANCELADO'],
  PRONTO: ['SAIU_PARA_ENTREGA', 'CANCELADO'],
  SAIU_PARA_ENTREGA: ['ENTREGUE', 'CANCELADO'],
};

const TERMINAL_STATUSES: StatusPedido[] = [
  'ENTREGUE',
  'CANCELADO',
  'RECUSADO',
  'FALHA_PAGAMENTO',
  'ESTORNADO',
];

export function isTerminalStatus(status: StatusPedido): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function nextStatuses(status: StatusPedido): StatusPedido[] {
  return NEXT_STATUS_TRANSITIONS[status] ?? [];
}