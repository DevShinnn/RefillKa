import type { Collection } from './types';

export type PayMethod = 'Cash' | 'GCash';

export type OrderPay = {
  method: PayMethod | null;
  paidOn: string | null;
  dueOn: string | null;
  deliveredOn: string | null;
};

export function parseOrderPay(notes: string | null | undefined): OrderPay {
  const text = notes ?? '';
  const due = /\[Due (\d{4}-\d{2}-\d{2})\]/.exec(text);
  const paid = /\[(Cash|GCash)\] Paid(?: (\d{4}-\d{2}-\d{2}))?/.exec(text);
  const delivered = /\[Delivered(?: (\d{4}-\d{2}-\d{2}))?\]/.exec(text);
  return {
    method: paid ? (paid[1] as PayMethod) : null,
    paidOn: paid?.[2] ?? null,
    dueOn: due?.[1] ?? null,
    deliveredOn: delivered ? (delivered[1] ?? '') : null,
  };
}

export function withDelivered(notes: string, ymd: string): string {
  if (/\[Delivered/.test(notes)) return notes;
  return `${(notes || '').trim()} · [Delivered ${ymd}]`;
}

export function isPendingOrder(order: Pick<Collection, 'is_reorder' | 'notes'>): boolean {
  return Boolean(order.is_reorder) && parseOrderPay(order.notes).deliveredOn === null;
}

export function isPastOrder(order: Pick<Collection, 'is_reorder' | 'notes'>): boolean {
  return Boolean(order.is_reorder) && parseOrderPay(order.notes).deliveredOn !== null;
}

export function orderLineTotal(order: Pick<Collection, 'unit_price' | 'quantity'>): number {
  return Number(order.unit_price ?? 0) * Math.max(1, Number(order.quantity) || 1);
}
