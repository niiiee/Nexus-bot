export interface CommandDocMetadata {
  name: string;
  descriptionEn: string;
  descriptionAr: string;
  category: 'Administration' | 'Rules & Moderation' | 'Marketplace & Deals' | 'Learning & Community';
  options: Array<{
    name: string;
    description: string;
    required: boolean;
    type: string;
  }>;
  requiresAdmin: boolean;
  memberCallable: boolean;
}

export interface CommandExplorerReport {
  commandCount: number;
  documentedCount: number;
  driftCount: number;
  commands: CommandDocMetadata[];
  markdownDocEn: string;
  markdownDocAr: string;
  isDriftFree: boolean;
}

export class CommandExplorer {
  private registry: Map<string, CommandDocMetadata> = new Map();

  constructor() {
    this.registerCoreCommands();
  }

  private registerCoreCommands(): void {
    this.registerCommand({
      name: 'setup',
      descriptionEn: 'Automated setup wizard for Senior Progg bot channels, roles, and dashboard',
      descriptionAr: 'معالج التهيئة الآلي لقنوات ورتب ولوحة تحكم بوت سينيور بروج',
      category: 'Administration',
      options: [
        { name: 'language', description: 'Preferred setup summary language (ar or en)', required: false, type: 'STRING' }
      ],
      requiresAdmin: true,
      memberCallable: false
    });

    this.registerCommand({
      name: 'rules',
      descriptionEn: 'View the 50 bilingual community rules of Nexus with search and category filters',
      descriptionAr: 'استعراض ميثاق وقواعد مجتمع نيكسس الـ 50 بند ثنائي اللغة مع فلاتر البحث والتصنيف',
      category: 'Rules & Moderation',
      options: [
        { name: 'category', description: 'Filter rules by category', required: false, type: 'STRING' },
        { name: 'query', description: 'Search rules by keyword', required: false, type: 'STRING' },
        { name: 'language', description: 'Language for display', required: false, type: 'STRING' }
      ],
      requiresAdmin: false,
      memberCallable: true
    });

    this.registerCommand({
      name: 'rule',
      descriptionEn: 'View specific community rule by ID (e.g. R01 to R50)',
      descriptionAr: 'استعراض تفاصيل بند محدد من القواعد عبر معرف البند (مثل R01 إلى R50)',
      category: 'Rules & Moderation',
      options: [
        { name: 'id', description: 'Rule ID (e.g. R01, R24)', required: true, type: 'STRING' },
        { name: 'language', description: 'Preferred display language', required: false, type: 'STRING' }
      ],
      requiresAdmin: false,
      memberCallable: true
    });

    this.registerCommand({
      name: 'mypoints',
      descriptionEn: 'View your active moderation points, violation history, and decay schedule',
      descriptionAr: 'عرض رصيد نقاطك التأديبية النشطة، وسجل المخالفات، ومواعيد سقوط النقاط',
      category: 'Rules & Moderation',
      options: [
        { name: 'language', description: 'Preferred display language', required: false, type: 'STRING' }
      ],
      requiresAdmin: false,
      memberCallable: true
    });

    this.registerCommand({
      name: 'appeal',
      descriptionEn: 'Submit an appeal for a moderation case to an independent reviewer',
      descriptionAr: 'تقديم استئناف على حالة تنظيمية لمراجعتها من قبل مشرف مستقل',
      category: 'Rules & Moderation',
      options: [
        { name: 'case_id', description: 'The case ID to appeal', required: true, type: 'STRING' },
        { name: 'statement', description: 'Explanation or context for appeal', required: true, type: 'STRING' },
        { name: 'language', description: 'Preferred display language', required: false, type: 'STRING' }
      ],
      requiresAdmin: false,
      memberCallable: true
    });
  }

  public registerCommand(metadata: CommandDocMetadata): void {
    this.registry.set(metadata.name.toLowerCase(), metadata);
  }

  public getCommand(name: string): CommandDocMetadata | null {
    return this.registry.get(name.toLowerCase()) || null;
  }

  /**
   * REQ-26.195: Introspect runtime command metadata and verify documentation drift
   */
  public generateDocs(knownCommandNames?: string[]): CommandExplorerReport {
    const commands = Array.from(this.registry.values());
    const expectedNames = knownCommandNames || commands.map((c) => c.name);

    let driftCount = 0;
    for (const name of expectedNames) {
      if (!this.registry.has(name.toLowerCase())) {
        driftCount++;
      }
    }

    // Generate English Markdown
    let mdEn = `# Nexus Bot Slash Commands Reference\n\n`;
    for (const cmd of commands) {
      mdEn += `### \`/${cmd.name}\`\n`;
      mdEn += `**Description**: ${cmd.descriptionEn}\n\n`;
      mdEn += `**Category**: ${cmd.category} | **Admin Required**: ${cmd.requiresAdmin ? 'Yes' : 'No'}\n\n`;
      if (cmd.options.length > 0) {
        mdEn += `| Option | Type | Required | Description |\n| :--- | :--- | :--- | :--- |\n`;
        for (const opt of cmd.options) {
          mdEn += `| \`${opt.name}\` | \`${opt.type}\` | ${opt.required ? 'Yes' : 'No'} | ${opt.description} |\n`;
        }
        mdEn += `\n`;
      }
    }

    // Generate Arabic Markdown
    let mdAr = `# دليل أوامر بوت نيكسس (Nexus Bot)\n\n`;
    for (const cmd of commands) {
      mdAr += `### \`/${cmd.name}\`\n`;
      mdAr += `**الوصف**: ${cmd.descriptionAr}\n\n`;
      mdAr += `**التصنيف**: ${cmd.category} | **يتطلب صلاحيات إدارة**: ${cmd.requiresAdmin ? 'نعم' : 'لا'}\n\n`;
      if (cmd.options.length > 0) {
        mdAr += `| الخيار | النوع | إلزامي | الوصف |\n| :--- | :--- | :--- | :--- |\n`;
        for (const opt of cmd.options) {
          mdAr += `| \`${opt.name}\` | \`${opt.type}\` | ${opt.required ? 'نعم' : 'لا'} | ${opt.description} |\n`;
        }
        mdAr += `\n`;
      }
    }

    return {
      commandCount: commands.length,
      documentedCount: commands.length,
      driftCount,
      commands,
      markdownDocEn: mdEn,
      markdownDocAr: mdAr,
      isDriftFree: driftCount === 0
    };
  }
}

export const commandExplorer = new CommandExplorer();
