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
import { MobilePageHeader } from '@/components/shared/MobilePageHeader';
import { SectionCard } from '@/components/shared/SectionCard';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
      <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] md:px-10 md:pt-10">
        <MobilePageHeader
          eyebrow="Superadmin · balanx"
          title={tab === 'visao' ? 'Visão geral' : tab === 'tenants' ? 'Tenants' : 'Pagamentos'}
          actions={
            <Button variant="outline" onClick={() => navigate('/')} className="h-10 gap-1.5 rounded-full px-4">
              <ArrowLeft className="h-4 w-4" /> App
            </Button>
          }
        />

        {/* Abas */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mb-5 md:mb-6">
          <TabsList>
            {(['visao', 'tenants', 'pagamentos'] as Tab[]).map((tb) => (
              <TabsTrigger key={tb} value={tb}>
                {tb === 'visao' ? 'Visão geral' : tb === 'tenants' ? 'Tenants' : 'Pagamentos'}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {loading ? (
          <LoadingSpinner />
        ) : tab === 'visao' ? (
          <div className="space-y-4 md:space-y-6">
            <KpiTriple
              className="mb-0"
              items={[
                { label: 'Tenants ativos', value: ativos, tone: 'steel', format: 'count' },
                { label: 'Usuários', value: totalUsuarios, tone: 'green', format: 'count' },
                { label: 'MRR plataforma', value: mrrPlataforma, tone: 'green' },
                { label: 'Cortesias', value: cortesias, tone: 'amber', format: 'count' },
              ]}
            />
            <SectionCard flush title="Cadastros recentes" description={`${Math.min(tenants.length, 8)} de ${tenants.length}`}>
              <TenantList tenants={tenants.slice(0, 8)} memberCount={memberCount} onOpen={setEditing} />
            </SectionCard>
          </div>
        ) : tab === 'tenants' ? (
          <SectionCard
            flush
            title="Organizações"
            description={`${filtered.length} ${filtered.length === 1 ? 'tenant' : 'tenants'}`}
          >
            <div className="relative px-4 pb-4 md:max-w-sm md:px-6">
              <Search className="absolute left-7 top-[22px] h-4 w-4 -translate-y-1/2 text-foreground-muted md:left-9" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar organização…"
                className="h-11 rounded-full bg-surface-2 pl-10"
              />
            </div>
            {filtered.length === 0 ? (
              <p className="border-t border-border py-10 text-center text-[14px] text-foreground-muted">Nenhum tenant encontrado.</p>
            ) : (
              <TenantList tenants={filtered} memberCount={memberCount} onOpen={setEditing} />
            )}
          </SectionCard>
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

/** Tabela no desktop, lista agrupada no mobile. Toque/clique abre o editor. */
function TenantList({ tenants, memberCount, onOpen }: {
  tenants: Tenant[]; memberCount: Record<string, number>; onOpen: (t: Tenant) => void;
}) {
  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Organização</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead className="text-right">Membros</TableHead>
              <TableHead className="pr-6 text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.map((t) => {
              const count = memberCount[t.id] || 0;
              return (
                <TableRow
                  key={t.id}
                  onClick={() => onOpen(t)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onOpen(t); }}
                  tabIndex={0}
                  className="cursor-pointer border-border"
                >
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-3">
                      <TenantAvatar nome={t.nome} />
                      <span className="truncate font-semibold text-foreground">{t.nome}</span>
                    </div>
                  </TableCell>
                  <TableCell className="capitalize text-foreground-muted">{t.tipo}</TableCell>
                  <TableCell className="capitalize text-foreground-muted">{t.plano}</TableCell>
                  <TableCell className="text-right font-heading font-semibold tabular-nums text-foreground">{count}</TableCell>
                  <TableCell className="pr-6 text-right"><StatusBadge status={t.status_assinatura} cortesia={t.cortesia} /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile */}
      <div className="border-t border-border px-3.5 md:hidden">
        {tenants.map((t) => {
          const count = memberCount[t.id] || 0;
          return (
            <button
              key={t.id}
              onClick={() => onOpen(t)}
              className="flex w-full items-center gap-3 border-b border-border py-3 text-left last:border-b-0"
            >
              <TenantAvatar nome={t.nome} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold text-foreground">{t.nome}</div>
                <div className="truncate text-[12px] capitalize text-foreground-muted">
                  {t.tipo} · {t.plano} · {count} {count === 1 ? 'membro' : 'membros'}
                </div>
              </div>
              <StatusBadge status={t.status_assinatura} cortesia={t.cortesia} />
            </button>
          );
        })}
      </div>
    </>
  );
}

function TenantAvatar({ nome }: { nome: string }) {
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-surface-2 text-[12px] font-semibold text-foreground">
      {initials(nome)}
    </span>
  );
}

function StatusBadge({ status, cortesia }: { status: string; cortesia: boolean }) {
  const label = cortesia ? 'Cortesia' : status;
  const cls = cortesia || status === 'ativa'
    ? 'bg-success-bg text-success-fg'
    : status === 'inadimplente' || status === 'cancelada'
      ? 'bg-danger-bg text-danger-fg'
      : 'bg-info-bg text-info-fg';
  return <span className={cn('inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize', cls)}>{label}</span>;
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
            className="flex w-full items-center gap-3 rounded-[16px] bg-success-bg px-4 py-3 text-left transition-opacity hover:opacity-90"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-surface text-success-fg">
              <Gift className="h-5 w-5" />
            </span>
            <div>
              <div className="text-sm font-semibold text-foreground">Liberar grátis (cortesia)</div>
              <div className="text-xs text-foreground-muted">Ativa o plano sem cobrança</div>
            </div>
          </button>

          <div className="flex items-center justify-between rounded-[16px] border border-border px-4 py-3">
            <div>
              <div className="text-sm font-medium text-foreground">Plano {PLAN.nome}</div>
              <div className="text-xs text-foreground-muted">{`R$ ${PLAN.precoMensal.toFixed(2).replace('.', ',')}/mês · 12× ${PLAN.precoAnualParcela.toFixed(2).replace('.', ',')}`}</div>
            </div>
            <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-foreground-muted">Único</span>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Status da assinatura</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-[16px] border border-border px-4 py-3">
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
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
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
    <div className="grid gap-4 md:grid-cols-2 md:gap-6">
      {/* Preço do plano único */}
      <SectionCard
        title={`Preço do plano ${PLAN.nome}`}
        description="Ao salvar, as assinaturas ativas são atualizadas no ASAAS automaticamente."
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Mensal (R$)</Label>
            <Input value={mensal} onChange={(e) => setMensal(e.target.value)} inputMode="decimal" disabled={!loaded} className="h-12 rounded-[14px] bg-surface-2" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Anual — parcela (R$)</Label>
            <Input value={anual} onChange={(e) => setAnual(e.target.value)} inputMode="decimal" disabled={!loaded} className="h-12 rounded-[14px] bg-surface-2" />
            <p className="text-[12px] text-foreground-muted">12× · total {`R$ ${((parseFloat(anual.replace(',', '.')) || 0) * 12).toFixed(2).replace('.', ',')}`}/ano</p>
          </div>
        </div>
        <Button className="mt-4 h-12 w-full rounded-full font-semibold" onClick={salvar} disabled={saving || !loaded}>
          {saving ? 'Salvando e sincronizando…' : 'Salvar e sincronizar no ASAAS'}
        </Button>
      </SectionCard>

      {/* ASAAS status */}
      <SectionCard>
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-[13px] bg-info-bg font-semibold text-info-fg">a</div>
          <div>
            <div className="text-sm font-semibold text-foreground">ASAAS</div>
            <div className="text-xs text-foreground-muted">Gateway de cobrança recorrente</div>
          </div>
        </div>
        <p className="mt-4 border-t border-border pt-4 text-sm text-foreground-muted">
          Ativação automática por evento (<span className="font-mono text-xs">PAYMENT_CONFIRMED</span> / <span className="font-mono text-xs">PAYMENT_RECEIVED</span>) via webhook. Métodos: Pix, boleto e cartão (o cliente escolhe na fatura).
        </p>
      </SectionCard>
    </div>
  );
}
