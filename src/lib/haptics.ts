/** Vibração tátil curta (onde o dispositivo suporta). Silencioso se indisponível. */
export function haptic(pattern: number | number[] = 15) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    /* noop */
  }
}
