import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export type PluginPermission =
  | 'discord:read'
  | 'discord:write'
  | 'webhooks:call'
  | 'storage:kv'
  | 'ai:prompt';

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  permissions: PluginPermission[];
  entryPoint: string;
  configSchema?: Record<string, { type: string; required?: boolean; default?: any }>;
}

export interface PluginRecord {
  id: string;
  name: string;
  version: string;
  author_id: string;
  description: string;
  manifest_json: string;
  permissions_json: string;
  status: 'approved' | 'in_review' | 'rejected' | 'deprecated';
  rating: number;
  install_count: number;
  created_at: number;
}

export interface TenantPluginRecord {
  id: string;
  tenant_id: string;
  plugin_id: string;
  config_json: string;
  is_enabled: number;
  installed_at: number;
}

export class PluginMarketplace {
  /**
   * REQ-24.0.3 / REQ-24.44.1: Community Plugin Commons Errata
   * Operates as a 100% free open registry with zero platform fees, zero revenue cuts, and open peer review.
   */
  public getCommonsPolicy(): { isFree: boolean; platformFeePercent: number; openReview: boolean } {
    return { isFree: true, platformFeePercent: 0, openReview: true };
  }

  /**
   * REQ-23.4.1: Register or publish a new plugin to the marketplace
   */
  public publishPlugin(
    authorId: string,
    manifest: PluginManifest
  ): PluginRecord {
    // Validate required manifest fields
    if (!manifest.name || !manifest.version || !manifest.permissions) {
      throw new Error('Invalid plugin manifest: name, version, and permissions are required');
    }

    const id = `plugin_${manifest.name.toLowerCase().replace(/[^a-z0-9_]/g, '_')}_${manifest.version.replace(/\./g, '_')}`;
    const now = Date.now();

    dbService.run(
      `INSERT INTO plugins (
         id, name, version, author_id, description, manifest_json,
         permissions_json, status, rating, install_count, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 5.0, 0, ?)`,
      id,
      manifest.name,
      manifest.version,
      authorId,
      manifest.description,
      JSON.stringify(manifest),
      JSON.stringify(manifest.permissions),
      now
    );

    return {
      id,
      name: manifest.name,
      version: manifest.version,
      author_id: authorId,
      description: manifest.description,
      manifest_json: JSON.stringify(manifest),
      permissions_json: JSON.stringify(manifest.permissions),
      status: 'approved',
      rating: 5.0,
      install_count: 0,
      created_at: now
    };
  }

  public listMarketplacePlugins(status = 'approved'): PluginRecord[] {
    return dbService.all<PluginRecord>(
      `SELECT * FROM plugins WHERE status = ? ORDER BY install_count DESC`,
      status
    );
  }

  public getPlugin(pluginId: string): PluginRecord | null {
    return dbService.get<PluginRecord>(
      `SELECT * FROM plugins WHERE id = ?`,
      pluginId
    ) || null;
  }

  /**
   * REQ-23.4.2 & REQ-23.4.3: Install plugin into a tenant with permission consent check
   */
  public installPlugin(
    tenantId: string,
    pluginId: string,
    acceptedPermissions: PluginPermission[],
    config: Record<string, any> = {}
  ): TenantPluginRecord {
    const plugin = this.getPlugin(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    const requiredPermissions: PluginPermission[] = JSON.parse(plugin.permissions_json);

    // REQ-23.4.2: Sandboxed capability permission check
    for (const req of requiredPermissions) {
      if (!acceptedPermissions.includes(req)) {
        throw new Error(`Cannot install plugin: missing consent for required permission '${req}'`);
      }
    }

    const existing = dbService.get<TenantPluginRecord>(
      `SELECT * FROM tenant_plugins WHERE tenant_id = ? AND plugin_id = ?`,
      tenantId,
      pluginId
    );

    const now = Date.now();
    let recordId: string;

    if (existing) {
      dbService.run(
        `UPDATE tenant_plugins SET config_json = ?, is_enabled = 1 WHERE id = ?`,
        JSON.stringify(config),
        existing.id
      );
      recordId = existing.id;
    } else {
      recordId = cryptoRandomUUID();
      dbService.run(
        `INSERT INTO tenant_plugins (id, tenant_id, plugin_id, config_json, is_enabled, installed_at)
         VALUES (?, ?, ?, ?, 1, ?)`,
        recordId,
        tenantId,
        pluginId,
        JSON.stringify(config),
        now
      );

      // Increment install count
      dbService.run(
        `UPDATE plugins SET install_count = install_count + 1 WHERE id = ?`,
        pluginId
      );
    }

    return {
      id: recordId,
      tenant_id: tenantId,
      plugin_id: pluginId,
      config_json: JSON.stringify(config),
      is_enabled: 1,
      installed_at: now
    };
  }

  /**
   * REQ-23.4.3: Uninstall plugin from tenant
   */
  public uninstallPlugin(tenantId: string, pluginId: string): boolean {
    const res = dbService.run(
      `DELETE FROM tenant_plugins WHERE tenant_id = ? AND plugin_id = ?`,
      tenantId,
      pluginId
    );
    return Number(res.changes) > 0;
  }

  /**
   * REQ-23.4.3: Toggle plugin enabled state
   */
  public togglePlugin(tenantId: string, pluginId: string, isEnabled: boolean): boolean {
    const res = dbService.run(
      `UPDATE tenant_plugins SET is_enabled = ? WHERE tenant_id = ? AND plugin_id = ?`,
      isEnabled ? 1 : 0,
      tenantId,
      pluginId
    );
    return Number(res.changes) > 0;
  }

  /**
   * REQ-23.4.4: Rate a plugin
   */
  public ratePlugin(pluginId: string, rating: number): number {
    const safeRating = Math.max(1, Math.min(5, rating));
    const plugin = this.getPlugin(pluginId);
    if (!plugin) throw new Error('Plugin not found');

    const newRating = Number(((plugin.rating + safeRating) / 2).toFixed(1));
    dbService.run(
      `UPDATE plugins SET rating = ? WHERE id = ?`,
      newRating,
      pluginId
    );
    return newRating;
  }

  public getInstalledPlugins(tenantId: string): Array<{ plugin: PluginRecord; installation: TenantPluginRecord }> {
    const installations = dbService.all<TenantPluginRecord>(
      `SELECT * FROM tenant_plugins WHERE tenant_id = ?`,
      tenantId
    );

    const result: Array<{ plugin: PluginRecord; installation: TenantPluginRecord }> = [];
    for (const inst of installations) {
      const plugin = this.getPlugin(inst.plugin_id);
      if (plugin) {
        result.push({ plugin, installation: inst });
      }
    }
    return result;
  }
}

export const pluginMarketplace = new PluginMarketplace();
