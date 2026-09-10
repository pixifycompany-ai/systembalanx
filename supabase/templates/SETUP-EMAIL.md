# Configuração de Email — BALANX (produção)

Provedor: **Resend** (grátis: 3.000 emails/mês, 100/dia) · DNS: **Hostinger** · Auth: **Supabase**

Ordem: **1) Resend + DNS → 2) Supabase SMTP → 3) Site URL / Redirects → 4) Templates → 5) Teste**

---

## 1) Resend + verificação do domínio (no Hostinger)

1. Crie conta em https://resend.com (grátis).
2. **Domains → Add Domain** → `balanx.com.br`.
3. O Resend vai gerar registros DNS (MX + TXT do SPF, e 1–3 CNAMEs de DKIM). Ex.:
   - `MX`  → host `send`  → valor `feedback-smtp.us-east-1.amazonses.com` (prioridade 10)
   - `TXT` → host `send`  → `v=spf1 include:amazonses.com ~all`
   - `TXT` → host `resend._domainkey` → (chave DKIM longa que o painel mostra)
   - *(às vezes 3 CNAMEs de DKIM no lugar do TXT — depende da conta; use o que aparecer)*
4. No **Hostinger → Domínios → DNS/Nameservers → Gerenciar registros DNS**, adicione **exatamente** os registros que o Resend mostrar.
   - ⚠️ O `MX` do subdomínio `send` **não** substitui o MX principal do `balanx.com.br` — não afeta sua caixa de entrada.
   - ⚠️ Se já existir um `TXT` de SPF no domínio raiz, **não duplique** — mantenha os dois (o do `send` é de um subdomínio distinto).
5. Volte no Resend e clique **Verify**. Pode levar de minutos até algumas horas (propagação DNS).
6. Depois de verificado: **API Keys** não é o que precisamos para SMTP — vá em **Settings → SMTP** e anote:
   - Host: `smtp.resend.com`
   - Porta: `465` (SSL) ou `587` (TLS)
   - Usuário: `resend`
   - Senha: **uma API Key** do Resend (crie em API Keys, permissão "Sending access"). Guarde — só aparece uma vez.

---

## 2) Supabase → Custom SMTP

Painel do projeto `hvwuuxvsoyovkvedifco` → **Authentication → Emails → SMTP Settings** → **Enable Custom SMTP**:

| Campo | Valor |
|---|---|
| Sender email | `no-reply@balanx.com.br` |
| Sender name | `BALANX` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | *(a API Key do Resend)* |

Salve. A partir daí **todos** os emails de auth (confirmação, reset de senha, troca de email) saem pelo Resend com o remetente do BALANX.

> Opcional: em **Rate Limits**, suba o limite de emails/hora (o padrão do Supabase é baixo). Com SMTP próprio pode aumentar com segurança.

---

## 3) Site URL + Redirect URLs (CRÍTICO)

**Authentication → URL Configuration**:

- **Site URL:** `https://app.balanx.com.br`
- **Redirect URLs** (adicione todas):
  - `https://app.balanx.com.br/**`
  - `https://app.balanx.com.br/redefinir-senha`
  - `http://localhost:8080/**` *(para continuar testando em dev)*

Sem isso, os links de confirmação e de reset apontam para o domínio errado (hoje o Lovable) e o fluxo quebra.

---

## 4) Templates de email

**Authentication → Emails → Templates**. Para cada um, cole o HTML do arquivo correspondente e ajuste o **Subject**:

| Template no Supabase | Arquivo | Subject sugerido |
|---|---|---|
| Confirm signup | `confirm-signup.html` | `Confirme seu email · BALANX` |
| Reset password | `reset-password.html` | `Redefinir sua senha · BALANX` |
| Change email address | `change-email.html` | `Confirme seu novo email · BALANX` |

As variáveis `{{ .ConfirmationURL }}` e `{{ .Email }}` são preenchidas pelo Supabase automaticamente.

---

## 5) Teste ponta a ponta

1. **Reset de senha:** no app (`/login` → "Esqueci minha senha"), peça o link com um email real → deve chegar pelo Resend → o link abre `/redefinir-senha` → troca a senha → login com a nova.
2. **Cadastro:** crie uma conta nova → deve chegar o email "Confirme seu email".
3. Confira no **Resend → Logs** se os envios aparecem como `delivered`.

---

## Pendente para depois (fora deste escopo)
- **2FA** (TOTP ou código por email) — etapa 2.
- **Deploy** em `app.balanx.com.br` e desligar o domínio do Lovable.
