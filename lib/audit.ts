/**
 * Generic audit logging (audit_logs table, migration_111).
 *
 * Currently only written to by the employee-portal feature (account/role
 * changes, submit/review/publish transitions, credit revocation, payout
 * transitions) but intentionally generic so other admin flows can reuse it.
 *
 * Never throws — an audit-log write failure must not block the action being
 * audited. Failures are logged to the server console instead.
 */

import { supabaseAdmin } from "./supabase-admin";

export type AuditLogEntry = {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  previousValue?: unknown;
  newValue?: unknown;
  metadata?: unknown;
  ipAddress?: string;
};

export async function logAudit(entry: AuditLogEntry): Promise<void> {
  const { error } = await supabaseAdmin.from("audit_logs").insert({
    actor_user_id: entry.actorUserId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    previous_value: entry.previousValue ?? null,
    new_value: entry.newValue ?? null,
    metadata: entry.metadata ?? null,
    ip_address: entry.ipAddress ?? null,
  });

  if (error) {
    console.error("[audit] failed to write audit log", { entry, error });
  }
}
