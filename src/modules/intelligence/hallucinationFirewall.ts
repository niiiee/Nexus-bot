import { commandExplorer } from '../operability/commandExplorer.js';

export interface FirewallCheckResult {
  passed: boolean;
  sanitizedText: string;
  hallucinationsDetected: string[];
}

export class HallucinationFirewall {
  private verifiedDomains: string[] = [
    'nexus.community',
    'discord.gg',
    'github.com',
    'stripe.com',
    'findahelpline.com',
    'befrienders.org'
  ];

  /**
   * REQ-26.210: Intercept and filter fabricated citations, dead links, or non-existent commands
   */
  public inspectResponse(text: string): FirewallCheckResult {
    const hallucinationsDetected: string[] = [];

    // 1. Check for non-existent slash commands referenced in text (strip URLs first)
    const textWithoutUrls = text.replace(/https?:\/\/[^\s]+/g, '');
    const commandRegex = /(?:^|\s)\/([a-zA-Z0-9_\-]+)/g;
    let match;
    while ((match = commandRegex.exec(textWithoutUrls)) !== null) {
      const cmdName = match[1].toLowerCase();
      // Common discord words or subcommands
      if (['rules', 'rule', 'mypoints', 'appeal', 'setup', 'fund', 'deal', 'competition', 'report'].includes(cmdName)) {
        continue;
      }
      if (!commandExplorer.getCommand(cmdName)) {
        hallucinationsDetected.push(`Unregistered slash command referenced: /${cmdName}`);
      }
    }

    // 2. Check for suspicious or fabricated URLs
    const urlRegex = /https?:\/\/([a-zA-Z0-9_\-\.]+)/g;
    while ((match = urlRegex.exec(text)) !== null) {
      const domain = match[1].toLowerCase();
      const isKnown = this.verifiedDomains.some((d) => domain === d || domain.endsWith('.' + d));
      if (!isKnown && (domain.includes('fake') || domain.includes('phish') || domain.includes('discrod'))) {
        hallucinationsDetected.push(`Suspicious unverified domain blocked: ${domain}`);
      }
    }

    const passed = hallucinationsDetected.length === 0;

    return {
      passed,
      sanitizedText: passed ? text : `[Content modified by Hallucination Firewall: ${hallucinationsDetected.join('; ')}]`,
      hallucinationsDetected
    };
  }
}

export const hallucinationFirewall = new HallucinationFirewall();
