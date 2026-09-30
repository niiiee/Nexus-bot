import { sha256 } from '../utils/crypto.js';

export interface TenantRecord {
  id: string;
  tenantId: string;
  data: string;
}

export class PgDatabaseAdapter {
  private currentTenantId: string | null = null;
  private isConnected = true;
  private isSafeReadOnlyMode = false;
  private tables: Map<string, TenantRecord[]> = new Map();

  constructor() {
    this.tables.set('members', []);
    this.tables.set('lead_staging', []);
  }

  public setTenantContext(tenantId: string): void {
    this.currentTenantId = tenantId;
  }

  public clearTenantContext(): void {
    this.currentTenantId = null;
  }

  public simulateConnectionLoss(): void {
    this.isConnected = false;
    this.isSafeReadOnlyMode = true;
  }

  public restoreConnection(): void {
    this.isConnected = true;
    this.isSafeReadOnlyMode = false;
  }

  public isReadOnlySafeMode(): boolean {
    return this.isSafeReadOnlyMode;
  }

  /**
   * Inserts a record honoring Row-Level Security tenant isolation.
   */
  public insertRow(table: string, record: { id: string; data: string; tenantId: string }): { success: boolean; error?: string } {
    if (this.isSafeReadOnlyMode) {
      return { success: false, error: 'Database in safe read-only mode: writes blocked' };
    }

    // RLS Enforcement: Current session tenant must match record tenant
    if (!this.currentTenantId || this.currentTenantId !== record.tenantId) {
      return { success: false, error: 'RLS Violation: Cannot insert row belonging to another tenant' };
    }

    const rows = this.tables.get(table) || [];
    rows.push(record);
    this.tables.set(table, rows);
    return { success: true };
  }

  /**
   * Queries records enforcing Row-Level Security tenant boundary.
   */
  public queryRows(table: string, requestingTenantId: string): TenantRecord[] {
    const rows = this.tables.get(table) || [];
    // RLS default-deny filter: Only rows matching requestingTenantId are visible
    return rows.filter((r) => r.tenantId === requestingTenantId);
  }

  /**
   * Verifies that service-role key is never included in client bundle configurations.
   */
  public verifyClientBundleSafety(bundleConfig: Record<string, unknown>): { isSafe: boolean; leakedKeys: string[] } {
    const leakedKeys: string[] = [];
    const sensitive = ['service_role', 'SUPABASE_SERVICE_ROLE_KEY', 'DATABASE_URL', 'DIRECT_DATABASE_URL'];

    for (const key of Object.keys(bundleConfig)) {
      if (sensitive.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
        leakedKeys.push(key);
      }
    }

    return {
      isSafe: leakedKeys.length === 0,
      leakedKeys
    };
  }
}

export const pgDatabaseAdapter = new PgDatabaseAdapter();
