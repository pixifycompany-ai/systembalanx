# Deploy — BALANX no Vercel (app.balanx.com.br)

Host: **Vercel** (git-connected, grátis) · Repo: `pixifycompany-ai/systembalanx` · DNS: **Hostinger**

O `vercel.json` já está no repo (build `npm run build`, saída `dist`, fallback de SPA). Só falta conectar.

---

## 1) Subir o código atualizado
No terminal, dentro da pasta do app:
```
git add -A && git commit -m "deploy: vercel.json + fluxo esqueci-senha + templates email" && git push
```

## 2) Importar no Vercel
1. Entre em https://vercel.com com o **GitHub** (a conta que tem acesso à org `pixifycompany-ai`).
2. **Add New → Project → Import** `pixifycompany-ai/systembalanx`.
3. O Vercel detecta **Vite** sozinho. Não precisa mexer em build/output (o `vercel.json` cuida).

## 3) ⚠️ Variáveis de ambiente (OBRIGATÓRIO — senão sobe quebrado)
Como o `.env` **não vai pro Git**, adicione em **Settings → Environment Variables** (todas nos 3 ambientes: Production/Preview/Development):

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://hvwuuxvsoyovkvedifco.supabase.co` |
| `VITE_SUPABASE_PROJECT_ID` | `hvwuuxvsoyovkvedifco` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_UiXet8EwrEK9ZdSOExLncw_8GUgON7-` |

Depois clique **Deploy**. Em ~1 min você recebe uma URL `https://systembalanx-xxxx.vercel.app`.

## 4) Testar na URL .vercel.app
- Abra a URL → faça **login** com sua conta (Lucas). Os dados devem aparecer.
- Teste dar F5 numa rota interna (ex: `/fluxo-caixa`) → deve carregar (não 404). Isso valida o fallback de SPA.

## 5) Domínio custom app.balanx.com.br
1. No projeto Vercel → **Settings → Domains → Add** → `app.balanx.com.br`.
2. O Vercel mostra um registro **CNAME**. Normalmente:
   - Tipo `CNAME` · Nome/Host `app` · Valor `cname.vercel-dns.com`
3. No **Hostinger → DNS/Nameservers → Gerenciar registros DNS**, adicione esse CNAME.
4. Volte no Vercel → ele valida e **provisiona o HTTPS automaticamente** (pode levar de minutos a ~1h).

## 6) Supabase — liberar o novo domínio
Painel Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://app.balanx.com.br`
- **Redirect URLs:** `https://app.balanx.com.br/**` (e mantenha `http://localhost:8080/**` p/ dev)

*(Login por senha já funciona sem isso; mas deixa configurado — é necessário quando ligarmos os emails.)*

## 7) Desligar o Lovable
Depois que `app.balanx.com.br` estiver no ar e testado:
- No **Lovable**, remova o domínio custom (ou pare de apontar DNS pra ele).
- Se algum registro DNS antigo do Lovable existir no Hostinger apontando `app` (ou o domínio), remova pra não conflitar com o CNAME do Vercel.

---

## Deploys futuros
A cada `git push` na branch principal, o Vercel **rebuilda e publica sozinho**. Não precisa fazer mais nada.

## Pendente (próxima fase)
- **Emails de auth** (Resend + SMTP) — ver `supabase/templates/SETUP-EMAIL.md`.
- **2FA**.
