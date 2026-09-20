import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Dispara `handler` quando a URL tem `?action=<action>` e limpa o parâmetro.
 * Usado pelo FAB adaptativo do mobile pra abrir o formulário de "novo" da tela
 * (ex.: /clientes?action=novo abre o modal de novo cliente).
 */
export function useActionParam(action: string, handler: () => void) {
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('action') === action) {
      handler();
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
}
