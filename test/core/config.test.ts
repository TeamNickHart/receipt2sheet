import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import { findConfigPath, loadConfig, saveConfig, resolveSpreadsheetPath } from '../../src/core/config.js';
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
