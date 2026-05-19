import fs from 'fs/promises';
import path from 'path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { ConfigSchema, type Config } from '../schemas/config.js';
import { fileExists } from '../utils/files.js';

const CONFIG_FILENAME = 'r2s.yaml';

export async function findConfigPath(startDir?: string): Promise<string | null> {
  let dir = startDir || process.cwd();

  // Walk up looking for r2s.yaml
  while (true) {
    const candidate = path.join(dir, CONFIG_FILENAME);
    if (await fileExists(candidate)) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

export async function loadConfig(
  configPath?: string,
): Promise<{ config: Config; configDir: string }> {
  const resolvedPath = configPath || (await findConfigPath());
  if (!resolvedPath) {
    throw new Error(
      'No r2s.yaml found. Run `r2s init` to set up a new project, or run from a directory containing r2s.yaml.',
    );
  }

  const raw = await fs.readFile(resolvedPath, 'utf-8');
  const parsed = parseYaml(raw);
  const config = ConfigSchema.parse(parsed);
  const configDir = path.dirname(resolvedPath);

  return { config, configDir };
}

export async function saveConfig(config: Config, configDir: string): Promise<void> {
  const configPath = path.join(configDir, CONFIG_FILENAME);
  const yaml = stringifyYaml(config, { lineWidth: 120 });
  await fs.writeFile(configPath, yaml, 'utf-8');
}

export function resolveSpreadsheetPath(configDir: string, template: string, year: number): string {
  const resolved = template.replace('{year}', String(year));
  return path.join(configDir, resolved);
}

/**
 * Learn vendor→category mappings from confirmed expenses.
 * Adds new vendors to config and updates categories if the user changed them during edit.
 * Returns the list of vendor names that were newly added or updated.
 */
export function learnVendors(
  config: Config,
  expenses: Array<{ vendor: string; category: string }>,
): string[] {
  const vendors = config.vendors || {};
  const changed: string[] = [];

  for (const { vendor, category } of expenses) {
    if (!vendor || !category) continue;

    // Check if this vendor name matches an existing vendor (exact key match)
    if (vendor in vendors) {
      if (vendors[vendor].category !== category) {
        vendors[vendor].category = category;
        changed.push(vendor);
      }
      continue;
    }

    // Check if vendor name matches an existing alias
    const aliasMatch = Object.entries(vendors).find(([, v]) =>
      v.aliases?.some((a) => a.toLowerCase() === vendor.toLowerCase()),
    );
    if (aliasMatch) {
      // Update the parent vendor's category if it changed
      if (aliasMatch[1].category !== category) {
        aliasMatch[1].category = category;
        changed.push(aliasMatch[0]);
      }
      continue;
    }

    // Check if this vendor name matches an existing vendor key (case-insensitive)
    const caseMatch = Object.keys(vendors).find((k) => k.toLowerCase() === vendor.toLowerCase());
    if (caseMatch) {
      if (vendors[caseMatch].category !== category) {
        vendors[caseMatch].category = category;
        changed.push(caseMatch);
      }
      continue;
    }

    // New vendor — add it
    vendors[vendor] = { category };
    changed.push(vendor);
  }

  config.vendors = vendors;
  return changed;
}
