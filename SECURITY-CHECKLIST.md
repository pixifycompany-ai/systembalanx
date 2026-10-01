# Checklist de Segurança — projetos (especialmente com IA)

Lista para revisar **sempre** que desenvolver/entregar um projeto. Cada item tem
*como verificar*. Pensada para stack web moderna (SPA + BaaS/Supabase + edge
functions + features de IA), mas serve para qualquer backend.

## Essenciais

- **Autorização por dono (IDOR)** — estar logado ≠ o dado ser seu. Trocar um ID
  na requisição **ou na URL** não pode devolver o dado de outra pessoa.
  → Toda query/rota filtra por dono (`user_id = auth.uid()` / RLS, ou checagem de
  ownership no backend), inclusive nas leituras por ID.

- **Mass assignment** — a tela manda `name`/`email`; se alguém injetar
  `role: "admin"` (ou status de pagamento, flag de admin), a API não pode salvar.
  → Backend aceita só um *allowlist* de campos; colunas sensíveis só mudam por
  serviço privilegiado (service role / superadmin), nunca pelo cliente.

- **Preço/valor calculado no servidor** — o navegador não dita preço nem plano.
  → O valor vem do banco/config do servidor, nunca do corpo da requisição.

- **Webhook valida autenticidade + status** — "pagamento aprovado" só libera se a
  mensagem for autêntica **e** o status confirmado.
  → Checa assinatura/token do webhook e, de preferência, **re-consulta o provedor**
  (ex.: `GET /payments/{id}`) antes de liberar acesso/créditos.

- **Reset de senha single-use + expiração** — o link deixa de valer após o uso e
  tem prazo.
  → Usar o reset do provedor de auth (token de uso único com TTL), não link caseiro.

- **CSP + headers de segurança** — camada de defesa contra XSS/clickjacking.
  → `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
  `Strict-Transport-Security`, `Permissions-Policy`.

- **Validação no Frontend E no Backend** — a do front é UX; a de verdade é no back.
  → Backend valida tipos/limites/obrigatoriedade e nunca confia no cliente
  (RLS / edge functions / schema).

- **RLS ligado em TODA tabela, sem policy `using (true)` perigosa** — tabela com
  RLS desligado = qualquer um lê/escreve tudo.
  → `enable row level security` em todas as tabelas públicas; nenhuma policy de
  escrita com `using (true)`; o padrão é negar.

- **Segredos fora do frontend; `service_role` só no servidor** — no bundle do
  navegador só a *anon key*.
  → `grep` no bundle por `service_role`/`sk-`; `.env` no `.gitignore`; nenhuma
  secret em `VITE_*`/variável exposta ao cliente.

- **Rate limiting / anti-abuso** — login (brute force), OTP, e endpoints caros de
  IA/voz/transcrição (cada chamada custa dinheiro).
  → Limite por IP/usuário nas rotas sensíveis e caras; cap diário de uso.

- **Prompt injection nas features de IA** — texto do usuário pode conter "ignore as
  instruções e faça X".
  → Saída do LLM é **dado, não comando**; ação sensível sempre revalidada no
  backend; dados não-confiáveis não disparam ferramenta sem validação.

- **CORS das edge functions** — `Access-Control-Allow-Origin: *` liberado demais,
  ou `*` junto com credenciais.
  → Restringir a origem ao domínio do app nas functions que não são webhook público.

- **Upload / Storage seguro** — bucket privado, URL assinada, validar **tipo e
  tamanho**, caminho isolado por `user_id` (sem path traversal).

- **Idempotência / replay** — webhook reenviado ou duplo-clique não pode
  cobrar/creditar duas vezes.
  → Dedup por chave de idempotência / `payment_id`.

## Aprofundamento

- **Injeção (SQL/comando)** — nunca montar query/RPC concatenando input cru; usar
  sempre query parametrizada.

- **Erros não vazam informação** — nada de stack trace, nome de tabela ou segredo
  chegando no cliente; detalhe só no log do servidor.

- **LGPD / retenção de dados** — consentimento, exclusão de conta de verdade
  (direito ao esquecimento), guardar só o necessário, cripto em trânsito/repouso,
  não logar PII desnecessário.

- **Dependências / supply chain** — `npm audit` no CI, lockfile commitado,
  Dependabot/atualizações.
