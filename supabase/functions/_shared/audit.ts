// Auditoria de ações sensíveis. Grava em public.audit_log via service role
// (RLS: só super admin lê). Nunca grava senha/segredo. Fail-safe: erro não quebra a ação.
// deno-lint-ignore-file no-explicit-any

export function reqIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  return xff ? xff.split(",")[0].trim() : (req.headers.get("x-real-ip") || null);
}

export interface AuditEntry {
  actor_user_id?: string | null;
  actor_email?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  tenant_id?: string | null;
  ip?: string | null;
  metadata?: Record<string, unknown> | null;
  result?: "ok" | "forbidden" | "error";
}

export async function audit(admin: any, entry: AuditEntry): Promise<void> {
  try {
    await admin.from("audit_log").insert({
      actor_user_id: entry.actor_user_id ?? null,
      actor_email: entry.actor_email ?? null,
      action: entry.action,
      entity_type: entry.entity_type ?? null,
      entity_id: entry.entity_id ?? null,
      tenant_id: entry.tenant_id ?? null,
      ip: entry.ip ?? null,
      metadata: entry.metadata ?? null,
      result: entry.result ?? "ok",
    });
  } catch (_e) { /* auditoria nunca quebra a ação */ }
}
