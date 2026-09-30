import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { TenantRecord } from './tenantManager.js';

export type TonePreset =
  | 'egyptian_casual'
  | 'friendly_professional'
  | 'concise_technical'
  | 'formal_corporate';

export interface BrandKitRecord {
  tenant_id: string;
  brand_name: string;
  primary_color: string;
  secondary_color: string;
  font_family: string;
  logo_url: string | null;
  tone_preset: TonePreset;
  custom_embed_theme_json: string;
  powered_by_badge: number;
  updated_at: number;
}

export interface EmbedThemeConfig {
  headerColor: string;
  accentColor: string;
  footerText?: string;
  footerIconUrl?: string;
  authorIconUrl?: string;
}

export interface UpdateBrandKitOptions {
  brandName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  logoUrl?: string;
  tonePreset?: TonePreset;
  embedTheme?: EmbedThemeConfig;
  poweredByBadge?: boolean;
}

export class BrandingManager {
  public static charterFreeMode = false;

  /**
   * REQ-23.3.1: Retrieve brand kit for tenant with fallback defaults
   */
  public getBrandKit(tenantId: string): BrandKitRecord {
    const existing = dbService.get<BrandKitRecord>(
      `SELECT * FROM brand_kits WHERE tenant_id = ?`,
      tenantId
    );

    if (existing) {
      return existing;
    }

    const defaultKit: BrandKitRecord = {
      tenant_id: tenantId,
      brand_name: 'Nexus Guild',
      primary_color: '#5865F2',
      secondary_color: '#57F287',
      font_family: 'Inter, sans-serif',
      logo_url: null,
      tone_preset: 'friendly_professional',
      custom_embed_theme_json: JSON.stringify({
        headerColor: '#5865F2',
        accentColor: '#57F287'
      }),
      powered_by_badge: 1,
      updated_at: Date.now()
    };

    dbService.run(
      `INSERT INTO brand_kits (
         tenant_id, brand_name, primary_color, secondary_color,
         font_family, logo_url, tone_preset, custom_embed_theme_json,
         powered_by_badge, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      defaultKit.tenant_id,
      defaultKit.brand_name,
      defaultKit.primary_color,
      defaultKit.secondary_color,
      defaultKit.font_family,
      defaultKit.logo_url,
      defaultKit.tone_preset,
      defaultKit.custom_embed_theme_json,
      defaultKit.powered_by_badge,
      defaultKit.updated_at
    );

    return defaultKit;
  }

  /**
   * REQ-23.3.1, REQ-23.3.2, REQ-23.3.3: Update brand kit with tier entitlement enforcement
   */
  public updateBrandKit(
    tenantId: string,
    options: UpdateBrandKitOptions
  ): BrandKitRecord {
    const current = this.getBrandKit(tenantId);
    const tenant = dbService.get<TenantRecord>(
      `SELECT * FROM tenants WHERE id = ?`,
      tenantId
    );

    // REQ-23.3.3 vs REQ-24.0.3 Charter Errata:
    // If charterFreeMode is enabled or environment flag is active, white-labeling is free for all communities.
    // Otherwise in commercial mode, Business or Enterprise subscription is required.
    let allowBadgeRemoval = false;
    if (BrandingManager.charterFreeMode || process.env.NEXUS_CHARTER_FREE === 'true' || (tenant && (tenant.plan_tier === 'business' || tenant.plan_tier === 'enterprise'))) {
      allowBadgeRemoval = true;
    }

    let poweredByBadge = current.powered_by_badge;
    if (options.poweredByBadge !== undefined) {
      if (options.poweredByBadge === false && !allowBadgeRemoval) {
        throw new Error('Removing the "Powered by Nexus" attribution requires a Business or Enterprise subscription.');
      }
      poweredByBadge = options.poweredByBadge ? 1 : 0;
    }

    const brandName = options.brandName ?? current.brand_name;
    const primaryColor = options.primaryColor ?? current.primary_color;
    const secondaryColor = options.secondaryColor ?? current.secondary_color;
    const fontFamily = options.fontFamily ?? current.font_family;
    const logoUrl = options.logoUrl !== undefined ? options.logoUrl : current.logo_url;
    const tonePreset = options.tonePreset ?? current.tone_preset;
    const customEmbedTheme = options.embedTheme
      ? JSON.stringify(options.embedTheme)
      : current.custom_embed_theme_json;
    const now = Date.now();

    dbService.run(
      `UPDATE brand_kits
       SET brand_name = ?, primary_color = ?, secondary_color = ?,
           font_family = ?, logo_url = ?, tone_preset = ?,
           custom_embed_theme_json = ?, powered_by_badge = ?, updated_at = ?
       WHERE tenant_id = ?`,
      brandName,
      primaryColor,
      secondaryColor,
      fontFamily,
      logoUrl,
      tonePreset,
      customEmbedTheme,
      poweredByBadge,
      now,
      tenantId
    );

    return {
      tenant_id: tenantId,
      brand_name: brandName,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      font_family: fontFamily,
      logo_url: logoUrl,
      tone_preset: tonePreset,
      custom_embed_theme_json: customEmbedTheme,
      powered_by_badge: poweredByBadge,
      updated_at: now
    };
  }

  /**
   * REQ-23.3.4: Build customized Discord embed object with tenant branding applied
   */
  public styleEmbed(
    tenantId: string,
    rawEmbed: { title: string; description: string; fields?: Array<{ name: string; value: string }> }
  ): {
    title: string;
    description: string;
    color: number;
    footer?: { text: string; icon_url?: string };
    thumbnail?: { url: string };
    fields?: Array<{ name: string; value: string }>;
  } {
    const brand = this.getBrandKit(tenantId);
    const colorHex = brand.primary_color.replace('#', '');
    const colorInt = parseInt(colorHex, 16) || 0x5865f2;

    const embed: any = {
      title: rawEmbed.title,
      description: rawEmbed.description,
      color: colorInt,
      fields: rawEmbed.fields || []
    };

    if (brand.logo_url) {
      embed.thumbnail = { url: brand.logo_url };
    }

    if (brand.powered_by_badge) {
      embed.footer = {
        text: `Powered by Nexus Platform • ${brand.brand_name}`,
        icon_url: 'https://nexus.platform/assets/logo-badge.png'
      };
    } else {
      embed.footer = {
        text: brand.brand_name
      };
    }

    return embed;
  }

  /**
   * REQ-23.3.2: Get system instructions modifier for AI brain based on tenant tone
   */
  public getTonePromptModifier(tone: TonePreset): string {
    switch (tone) {
      case 'egyptian_casual':
        return 'Adopt a friendly, casual Egyptian tech community tone. Use familiar Egyptian phrasing (e.g., يا بطل, عاش, منور, تمام يا هندسة), be warm, collaborative, and approachable.';
      case 'concise_technical':
        return 'Adopt a concise, engineer-to-engineer technical tone. Provide code snippets, bullet points, and direct answers without filler pleasantries.';
      case 'formal_corporate':
        return 'Adopt a formal, corporate enterprise tone. Use professional business vocabulary, structured headers, and diplomatic communication.';
      case 'friendly_professional':
      default:
        return 'Adopt a welcoming, supportive, and highly competent professional tone.';
    }
  }
}

export const brandingManager = new BrandingManager();
