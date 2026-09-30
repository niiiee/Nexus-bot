import fs from 'fs';
import path from 'path';

const yamlPath = path.resolve('docs/rules.yaml');
const outPath = path.resolve('src/modules/rules/rulesData.ts');

const content = fs.readFileSync(yamlPath, 'utf-8');
const lines = content.split('\n');

const rules = [];
let currentRule = null;

for (let line of lines) {
  const trimmed = line.trim();
  if (trimmed.startsWith('- id:')) {
    if (currentRule) {
      rules.push(currentRule);
    }
    const id = trimmed.replace('- id:', '').replace(/["']/g, '').trim();
    currentRule = { id };
  } else if (currentRule) {
    if (trimmed.startsWith('name_en:')) {
      currentRule.name_en = trimmed.replace('name_en:', '').trim().replace(/^["']+|["']+$/g, '');
    } else if (trimmed.startsWith('name_ar:')) {
      currentRule.name_ar = trimmed.replace('name_ar:', '').trim().replace(/^["']+|["']+$/g, '');
    } else if (trimmed.startsWith('severity:')) {
      currentRule.severity = trimmed.replace('severity:', '').trim().replace(/^["']+|["']+$/g, '');
    } else if (trimmed.startsWith('mode:')) {
      currentRule.mode = trimmed.replace('mode:', '').trim().replace(/^["']+|["']+$/g, '');
    } else if (trimmed.startsWith('points:')) {
      currentRule.points = parseInt(trimmed.replace('points:', '').trim(), 10);
    } else if (trimmed.startsWith('decay_days:')) {
      currentRule.decay_days = parseInt(trimmed.replace('decay_days:', '').trim(), 10);
    } else if (trimmed.startsWith('auto_max_action:')) {
      currentRule.auto_max_action = trimmed.replace('auto_max_action:', '').trim().replace(/^["']+|["']+$/g, '');
    } else if (trimmed.startsWith('description_en:')) {
      currentRule.description_en = trimmed.replace('description_en:', '').trim().replace(/^["']+|["']+$/g, '');
    } else if (trimmed.startsWith('description_ar:')) {
      currentRule.description_ar = trimmed.replace('description_ar:', '').trim().replace(/^["']+|["']+$/g, '');
    }
  }
}
if (currentRule) {
  rules.push(currentRule);
}

// Add categories based on rule id ranges
// R01-R10: General Safety & Integrity
// R11-R20: Professional Ethics & Deal Honesty
// R21-R30: Marketplace & Care Policies
// R31-R40: Platform & Resource Fair-Use
// R41-R50: Community Culture & Mutual Respect
for (const r of rules) {
  const num = parseInt(r.id.replace('R', ''), 10);
  if (num <= 10) r.category = 'Safety & Platform Security';
  else if (num <= 20) r.category = 'Professional Ethics & Competence';
  else if (num <= 30) r.category = 'Marketplace Integrity & Care';
  else if (num <= 40) r.category = 'Resource Access & Fair-Use';
  else r.category = 'Community Culture & Collaboration';
}

const tsContent = `// Auto-generated from docs/rules.yaml - 50 Bilingual Community Rules (R01 to R50)
export interface CommunityRule {
  id: string;
  name_en: string;
  name_ar: string;
  category: string;
  severity: 'S1' | 'S2' | 'S3' | 'S4' | 'Care';
  mode: 'A' | 'S' | 'H' | 'C';
  points: number;
  decay_days: number;
  auto_max_action: 'none' | 'reminder' | 'warning' | 'timeout_1h' | 'hide_and_case' | 'protective_hold' | 'emergency_hold' | 'care_outreach';
  description_en: string;
  description_ar: string;
}

export const COMMUNITY_RULES: CommunityRule[] = ${JSON.stringify(rules, null, 2)};
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, tsContent, 'utf-8');
console.log(`Generated ${rules.length} rules in ${outPath}`);
