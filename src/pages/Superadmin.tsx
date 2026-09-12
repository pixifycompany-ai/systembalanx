import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenant, type Tenant } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { KpiTriple } from '@/components/shared/KpiTriple';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Search, Gift } from 'lucide-react';
import { formatCurrency } from '@/utils/formatters';
import { PLAN } from '@/lib/plans';
import { cn } from '@/lib/utils';

const sb = supabase as any;

const STATUS = [
  { value: 'trial', label: 'Trial' },
  { value: 'ativa', label: 'Ativa' },
  { value: 'inadimplente', label: 'Inadimplente' },
  { value: 'cancelada', label: 'Cancelada' },
  { value: 'cortesia', label: 'Cortesia (liberado)' },
];

function initials(nome: string) {
  return (nome || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

type Tab = 'visao' | 'tenants' | 'pagamentos';

export default function Superadmin() {
  const { isSuperadmin, loading: tenantLoading } = useTenant();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('visao');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [members, setMembers] = useState<{ tenant_id: string; user_id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Tenant | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: t }, { data: m }] = await Promise.all([
      sb.from('tenants').select('*').order('created_at', { ascending: false }),
      sb.from('tenant_members').select('tenant_id, user_id'),
    ]);
    setTenants(t || []);
    setMembers(m || []);
    setLoading(false);
  };
  useEffect(() => { if (isSuperadmin) load(); }, [isSuperadmin]);

  const memberCount = useMemo(() => {
    const map: Record<string, number> = {};
    for (const mm of members) map[mm.tenant_id] = (map[mm.tenant_id] || 0) + 1;
    return map;
  }, [members]);

  const totalUsuarios = useMemo(() => new Set(members.map((m) => m.user_id)).size, [members]);
  const ativos = tenants.filter((t) => ['ativa', 'cortesia', 'trial'].includes(t.status_assinatura)).length;
  const cortesias = tenants.filter((t) => t.cortesia).length;
  const mrrPlataforma = tenants
    .filter((t) => t.status_assinatura === 'ativa' && !t.cortesia)
    .reduce((s) => s + PLAN.precoMensal, 0);

  const filtered = tenants.filter((t) => t.nome.toLowerCase().includes(search.toLowerCase()));

  if (!tenantLoading && !isSuperadmin) {
    return <Navigate to="/" replace />;
  }
  if (tenantLoading) {
    return <div className="min-h-[100dvh] grid place-items-center bg-background"><LoadingSpinner /></div>;
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="mx-auto w-full max-w-5xl px-4 md:px-8 pt-10 pb-16">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <p className="text-xs font-medium text-foreground-muted mb-0.5">Superadmin · balanx</p>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
              {tab === 'visao' ? 'Visão geral' : tab === 'tenants' ? 'Tenants' : 'Pagamentos'}
            </h1>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> App
          </Button>
        </div>

        {/* Tabs */}
        <div className="inline-flex rounded-2xl border border-border/60 bg-surface/70 backdrop-blur-xl p-1 mb-6">
          {(['visao', 'tenants', 'pagamentos'] as Tab[]).map((tb) => (
            <button
              key={tb}
              onClick={() => setTab(tb)}
              className={cn(
                'px-4 py-1.5 text-sm font-medium rounded-xl transition-colors',
                tab === tb ? 'bg-primary text-primary-foreground' : 'text-foreground-muted hover:text-foreground',
              )}
            >
              {tb === 'visao' ? 'Visão geral' : tb === 'tenants' ? 'Tenants' : 'Pagamentos'}
            </button>
          ))}
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : tab === 'visao' ? (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-6">
              <StatCard label="Tenants ativos" value={String(ativos)} tone="steel" />
              <StatCard label="Usuários" value={String(totalUsuarios)} tone="green" />
              <StatCard label="MRR plataforma" value={formatCurrency(mrrPlataforma)} tone="amber" />
              <StatCard label="Cortesias" value={String(cortesias)} tone="steel" />
            </div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Cadastros recentes</h2>
            <div className="space-y-2">
              {tenants.slice(0, 8).map((t) => (
                <TenantRow key={t.id} t={t} count={memberCount[t.id] || 0} onClick={() => setEditing(t)} />
              ))}
            </div>
          </div>
        ) : tab === 'tenants' ? (
          <div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar organização…"
                className="pl-9"
              />
            </div>
            <div className="space-y-2">
              {filtered.map((t) => (
                <TenantRow key={t.id} t={t} count={memberCount[t.id] || 0} onClick={() => setEditing(t)} />
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-foreground-muted py-8 text-center">Nenhum tenant encontrado.</p>
              )}
            </div>
          </div>
        ) : (
          <PagamentosTab />
        )}
      </div>

      {editing && (
        <TenantEditor
          tenant={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: 'steel' | 'green' | 'amber' }) {
  const bar = tone === 'green' ? 'bg-[hsl(var(--success))]' : tone === 'amber' ? 'bg-[hsl(var(--warning))]' : 'bg-primary';
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-surface/70 backdrop-blur-xl px-3 py-3.5">
      <span className={cn('absolute inset-x-0 top-0 h-[3px]', bar)} />
      <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">{label}</div>
      <div className="mt-1.5 text-lg font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function TenantRow({ t, count, onClick }: { t: Tenant; count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/70 backdrop-blur-xl px-4 py-3 text-left hover:border-primary/40 transition-colors"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary text-xs font-semibold">
        {initials(t.nome)}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-foreground truncate">{t.nome}</div>
        <div className="text-xs text-foreground-muted truncate capitalize">
          {t.tipo} · {t.plano} · {count} {count === 1 ? 'membro' : 'membros'}
        </div>
      </div>
      <StatusBadge status={t.status_assinatura} cortesia={t.cortesia} />
    </button>
  );
}

function StatusBadge({ status, cortesia }: { status: string; cortesia: boolean }) {
  const label = cortesia ? 'Cortesia' : status;
  const cls = cortesia || status === 'ativa'
    ? 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]'
    : status === 'inadimplente' || status === 'cancelada'
      ? 'bg-[hsl(var(--danger))]/15 text-[hsl(var(--danger))]'
      : 'bg-primary/15 text-primary';
  return <span className={cn('shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize', cls)}>{label}</span>;
}

function TenantEditor({ tenant, onClose, onSaved }: { tenant: Tenant; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [status, setStatus] = useState(tenant.status_assinatura);
  const [cortesia, setCortesia] = useState(tenant.cortesia);
  const [liberadoAte, setLiberadoAte] = useState(tenant.acesso_liberado_ate || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await sb.from('tenants').update({
      plano: PLAN.id,
      status_assinatura: status,
      cortesia,
      acesso_liberado_ate: liberadoAte || null,
      updated_at: new Date().toISOString(),
    }).eq('id', tenant.id);
    setSaving(false);
    if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Tenant atualizado', description: tenant.nome });
    onSaved();
  };

  const liberarGratis = () => {
    setCortesia(true);
    setStatus('cortesia');
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{tenant.nome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <button
            onClick={liberarGratis}
            className="w-full flex items-center gap-3 rounded-xl border border-[hsl(var(--success))]/40 bg-[hsl(var(--success))]/10 px-4 py-3 text-left hover:bg-[hsl(var(--success))]/15 transition-colors"
          >
            <Gift className="h-5 w-5 text-[hsl(var(--success))]" />
            <div>
              <div className="text-sm font-semibold text-foreground">Liberar grátis (cortesia)</div>
              <div className="text-xs text-foreground-muted">Ativa o plano sem cobrança</div>
            </div>
          </button>

          <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
            <div>
              <div className="text-sm font-medium text-foreground">Plano {PLAN.nome}</div>
              <div className="text-xs text-foreground-muted">{`R$ ${PLAN.precoMensal.toFixed(2).replace('.', ',')}/mês · 12× ${PLAN.precoAnualParcela.toFixed(2).replace('.', ',')}`}</div>
            </div>
            <span className="text-[10px] font-semibold uppercase text-foreground-muted">Único</span>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Status da assinatura</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
            <div>
              <div className="text-sm font-medium text-foreground">Cortesia</div>
              <div className="text-xs text-foreground-muted">Acesso liberado sem pagar</div>
            </div>
            <Switch checked={cortesia} onCheckedChange={setCortesia} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Liberado até (opcional)</Label>
            <Input type="date" value={liberadoAte} onChange={(e) => setLiberadoAte(e.target.value)} />
            <p className="text-[11px] text-foreground-muted">Vazio = sem limite de data.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PagamentosTab() {
  const { toast } = useToast();
  const [mensal, setMensal] = useState('');
  const [anual, setAnual] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await sb.from('plataforma_config').select('preco_mensal, preco_anual_parcela').eq('id', true).maybeSingle();
      setMensal(String(data?.preco_mensal ?? PLAN.precoMensal));
      setAnual(String(data?.preco_anual_parcela ?? PLAN.precoAnualParcela));
      setLoaded(true);
    })();
  }, []);

  const salvar = async () => {
    const pm = parseFloat(mensal.replace(',', '.'));
    const pa = parseFloat(anual.replace(',', '.'));
    if (!(pm > 0) || !(pa > 0)) { toast({ title: 'Preços inválidos', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asaas-sync-plano`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ preco_mensal: pm, preco_anual_parcela: pa }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Erro ao salvar');
      toast({ title: 'Preço atualizado', description: `Config salva. ${data.assinaturas_atualizadas ?? 0} assinatura(s) sincronizada(s) no ASAAS.` });
    } catch (e) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : 'Falha', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Preço do plano único */}
      <div className="rounded-2xl border border-border/60 bg-surface/70 backdrop-blur-xl p-5">
        <div className="text-sm font-semibold text-foreground">Preço do plano {PLAN.nome}</div>
        <p className="text-xs text-foreground-muted mt-0.5 mb-4">Ao salvar, as assinaturas ativas são atualizadas no ASAAS automaticamente.</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Mensal (R$)</Label>
            <Input value={mensal} onChange={(e) => setMensal(e.target.value)} inputMode="decimal" disabled={!loaded} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Anual — parcela (R$)</Label>
            <Input value={anual} onChange={(e) => setAnual(e.target.value)} inputMode="decimal" disabled={!loaded} />
            <p className="text-[10px] text-foreground-muted">12× · total {`R$ ${((parseFloat(anual.replace(',', '.')) || 0) * 12).toFixed(2).replace('.', ',')}`}/ano</p>
          </div>
        </div>
        <Button className="mt-4 w-full" onClick={salvar} disabled={saving || !loaded}>
          {saving ? 'Salvando e sincronizando…' : 'Salvar e sincronizar no ASAAS'}
        </Button>
      </div>

      {/* ASAAS status */}
      <div className="rounded-2xl border border-border/60 bg-surface/70 backdrop-blur-xl p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#1f50e2] text-white font-semibold">a</div>
          <div>
            <div className="text-sm font-semibold text-foreground">ASAAS</div>
            <div className="text-xs text-foreground-muted">Gateway de cobrança recorrente</div>
          </div>
        </div>
        <p className="mt-4 pt-4 border-t border-border/60 text-sm text-foreground-muted">
          Ativação automática por evento (<span className="font-mono text-xs">PAYMENT_CONFIRMED</span> / <span className="font-mono text-xs">PAYMENT_RECEIVED</span>) via webhook. Métodos: Pix, boleto e cartão (o cliente escolhe na fatura).
        </p>
      </div>
    </div>
  );
}
