import { parseISO, startOfDay, isEqual, isBefore } from 'date-fns';

/**
 * Determines the display status for a financial item
 * - If status is already 'recebido'/'pago', keep it
 * - If status is 'atrasado', keep it
 * - If status is 'pendente' and due date is today, show 'vence_hoje'
 * - If status is 'pendente' and due date is past, should have been marked 'atrasado'
 */
export function getDisplayStatus(
  status: string,
  dataVencimento: string | null | undefined
): string {
  // Already completed or overdue
  if (status === 'recebido' || status === 'pago' || status === 'atrasado') {
    return status;
  }

  // Check due date for pending items
  if (status === 'pendente' && dataVencimento) {
    const vencimento = startOfDay(parseISO(dataVencimento));
    const hoje = startOfDay(new Date());

    // Due today
    if (isEqual(vencimento, hoje)) {
      return 'vence_hoje';
    }

    // Overdue (should have been updated to 'atrasado' by the hook)
    if (isBefore(vencimento, hoje)) {
      return 'atrasado';
    }
  }

  return status;
}
