import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import {
  findConfigPath,
  loadConfig,
  saveConfig,
  resolveSpreadsheetPath,
  learnVendors,
} from '../../src/core/config.js';
import type { Config } from '../../src/schemas/config.js';
import { createTempDir, cleanupTempDir, writeTempFile } from '../helpers/mock-fs.js';

const VALID_CONFIG_PATH = path.resolve(import.meta.dirname!, '../fixtures/configs/valid-config.yaml');
const MINIMAL_CONFIG_PATH = path.resolve(import.meta.dirname!, '../fixtures/configs/minimal-config.yaml');

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await createTempDir();
});

afterEach(async () => {
  await cleanupTempDir(tmpDir);
});

describe('findConfigPath', () => {
  it('finds r2s.yaml in the given directory', async () => {
    await writeTempFile(tmpDir, 'r2s.yaml', 'version: 1\n');
    const result = await findConfigPath(tmpDir);
    expect(result).toBe(path.join(tmpDir, 'r2s.yaml'));
  });

  it('walks up to parent directory', async () => {
    await writeTempFile(tmpDir, 'r2s.yaml', 'version: 1\n');
    const subDir = path.join(tmpDir, 'subdir');
    await fs.mkdir(subDir);
    const result = await findConfigPath(subDir);
    expect(result).toBe(path.join(tmpDir, 'r2s.yaml'));
  });

  it('returns null when not found', async () => {
    const result = await findConfigPath(tmpDir);
    expect(result).toBeNull();
  });
});

describe('loadConfig', () => {
  it('loads a valid config file', async () => {
    const { config, configDir } = await loadConfig(VALID_CONFIG_PATH);
    expect(config.default_property).toBe('cabin');
    expect(config.properties).toHaveLength(1);
    expect(config.properties[0].id).toBe('cabin');
    expect(configDir).toBe(path.dirname(VALID_CONFIG_PATH));
  });

  it('loads a minimal config with defaults', async () => {
    const { config } = await loadConfig(MINIMAL_CONFIG_PATH);
    expect(config.default_property).toBe('rental');
    expect(config.version).toBe(1);
    expect(config.options.require_confirmation).toBe(true);
    expect(config.inbox).toBe('inbox/');
  });

  it('throws for missing config', async () => {
    await expect(loadConfig(path.join(tmpDir, 'nonexistent.yaml'))).rejects.toThrow();
  });

  it('throws for invalid config schema', async () => {
    const badConfig = await writeTempFile(tmpDir, 'r2s.yaml', 'version: 1\nproperties: []\n');
    await expect(loadConfig(badConfig)).rejects.toThrow();
  });
});

describe('saveConfig', () => {
  it('round-trips a config', async () => {
    const { config } = await loadConfig(VALID_CONFIG_PATH);
    await saveConfig(config, tmpDir);

    const { config: reloaded } = await loadConfig(path.join(tmpDir, 'r2s.yaml'));
    expect(reloaded.default_property).toBe(config.default_property);
    expect(reloaded.properties).toEqual(config.properties);
  });
});

describe('resolveSpreadsheetPath', () => {
  it('substitutes {year} in template', () => {
    const result = resolveSpreadsheetPath('/project', 'spreadsheets/Expenses_{year}.xlsx', 2026);
    expect(result).toBe(path.join('/project', 'spreadsheets/Expenses_2026.xlsx'));
  });

  it('handles template without {year}', () => {
    const result = resolveSpreadsheetPath('/project', 'spreadsheets/Capital.xlsx', 2026);
    expect(result).toBe(path.join('/project', 'spreadsheets/Capital.xlsx'));
  });
});

describe('learnVendors', () => {
  function makeMinimalConfig(vendors: Config['vendors'] = {}): Config {
    return {
      version: 1,
      properties: [{ id: 'cabin', name: 'Cabin', type: 'short-term-rental' }],
      default_property: 'cabin',
      spreadsheets: {
        operating_expenses: 'spreadsheets/Op_{year}.xlsx',
        capital_improvements: 'spreadsheets/Cap.xlsx',
        year_end_summary: 'spreadsheets/YE_{year}.xlsx',
      },
      categories: ['Supplies', 'Repairs', 'Utilities'],
      vendors,
      inbox: 'inbox/',
      processed: 'processed/',
      organize_processed_by: 'year-month',
      options: {
        require_confirmation: true,
        auto_categorize_known_vendors: true,
        move_processed_receipts: true,
        backup_spreadsheets: true,
      },
    };
  }

  it('adds a new vendor', () => {
    const config = makeMinimalConfig();
    const changed = learnVendors(config, [{ vendor: 'Home Depot', category: 'Supplies' }]);

    expect(changed).toEqual(['Home Depot']);
    expect(config.vendors!['Home Depot']).toEqual({ category: 'Supplies' });
  });

  it('adds multiple new vendors', () => {
    const config = makeMinimalConfig();
    const changed = learnVendors(config, [
      { vendor: 'Home Depot', category: 'Supplies' },
      { vendor: 'Peninsula Light', category: 'Utilities' },
    ]);

    expect(changed).toHaveLength(2);
    expect(config.vendors!['Home Depot'].category).toBe('Supplies');
    expect(config.vendors!['Peninsula Light'].category).toBe('Utilities');
  });

  it('does not duplicate existing vendors with same category', () => {
    const config = makeMinimalConfig({ Amazon: { category: 'Supplies' } });
    const changed = learnVendors(config, [{ vendor: 'Amazon', category: 'Supplies' }]);

    expect(changed).toEqual([]);
    expect(Object.keys(config.vendors!)).toEqual(['Amazon']);
  });

  it('updates category when user changed it', () => {
    const config = makeMinimalConfig({ Amazon: { category: 'Supplies' } });
    const changed = learnVendors(config, [{ vendor: 'Amazon', category: 'Repairs' }]);

    expect(changed).toEqual(['Amazon']);
    expect(config.vendors!['Amazon'].category).toBe('Repairs');
  });

  it('recognizes existing vendor by alias', () => {
    const config = makeMinimalConfig({
      Amazon: { category: 'Supplies', aliases: ['AMAZON.COM', 'AMZN'] },
    });
    const changed = learnVendors(config, [{ vendor: 'AMAZON.COM', category: 'Supplies' }]);

    expect(changed).toEqual([]);
  });

  it('updates category via alias match', () => {
    const config = makeMinimalConfig({
      Amazon: { category: 'Supplies', aliases: ['AMAZON.COM'] },
    });
    const changed = learnVendors(config, [{ vendor: 'AMAZON.COM', category: 'Repairs' }]);

    expect(changed).toEqual(['Amazon']);
    expect(config.vendors!['Amazon'].category).toBe('Repairs');
  });

  it('matches vendor names case-insensitively', () => {
    const config = makeMinimalConfig({ 'Home Depot': { category: 'Supplies' } });
    const changed = learnVendors(config, [{ vendor: 'home depot', category: 'Supplies' }]);

    expect(changed).toEqual([]);
  });

  it('updates category on case-insensitive match', () => {
    const config = makeMinimalConfig({ 'Home Depot': { category: 'Supplies' } });
    const changed = learnVendors(config, [{ vendor: 'home depot', category: 'Repairs' }]);

    expect(changed).toEqual(['Home Depot']);
    expect(config.vendors!['Home Depot'].category).toBe('Repairs');
  });

  it('skips entries with empty vendor or category', () => {
    const config = makeMinimalConfig();
    const changed = learnVendors(config, [
      { vendor: '', category: 'Supplies' },
      { vendor: 'Amazon', category: '' },
    ]);

    expect(changed).toEqual([]);
    expect(Object.keys(config.vendors!)).toHaveLength(0);
  });

  it('deduplicates same vendor appearing multiple times', () => {
    const config = makeMinimalConfig();
    const changed = learnVendors(config, [
      { vendor: 'Amazon', category: 'Supplies' },
      { vendor: 'Amazon', category: 'Supplies' },
    ]);

    // First one adds, second one is a no-op
    expect(changed).toEqual(['Amazon']);
  });

  it('preserves existing aliases when updating category', () => {
    const config = makeMinimalConfig({
      Amazon: { category: 'Supplies', aliases: ['AMZN', 'AMAZON.COM'] },
    });
    learnVendors(config, [{ vendor: 'Amazon', category: 'Repairs' }]);

    expect(config.vendors!['Amazon'].aliases).toEqual(['AMZN', 'AMAZON.COM']);
    expect(config.vendors!['Amazon'].category).toBe('Repairs');
  });
});
