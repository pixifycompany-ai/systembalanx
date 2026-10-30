// Frase relativa de vencimento para os lembretes (antes / no dia / em atraso).
// diff = dias até o vencimento (positivo = a vencer; 0 = hoje; negativo = vencida).
export function frasePrazo(diff: number): string {
  if (diff > 1) return `vence em ${diff} dias`;
  if (diff === 1) return "vence amanhã";
  if (diff === 0) return "vence hoje";
  if (diff === -1) return "está vencida há 1 dia";
  return `está vencida há ${Math.abs(diff)} dias`;
}
