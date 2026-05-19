import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import Anthropic from '@anthropic-ai/sdk';
import { findConfigPath, loadConfig, resolveSpreadsheetPath } from '../core/config.js';
import { fileExists, ensureDir } from '../utils/files.js';
import { currentYear } from '../utils/dates.js';
import { copyTemplate } from '../core/spreadsheet.js';
import { fileURLToPath } from 'url';
import { MODEL_ALIASES, resolveModel } from '../core/models.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

interface Check {
  label: string;
  status: 'ok' | 'warn' | 'fail';
  detail?: string;
  fix?: () => Promise<void>;
}

interface DoctorOptions {
  fix?: boolean;
}

export async function doctorCommand(options: DoctorOptions): Promise<void> {
  const checks: Check[] = [];

  // 1. Config file
  const configPath = await findConfigPath();
  if (configPath) {
    checks.push({ label: 'Config file', status: 'ok', detail: configPath });
  } else {
    checks.push({
      label: 'Config file',
      status: 'fail',
      detail: 'No r2s.yaml found. Run `r2s init` first.',
    });
    await printAndFix(checks, options.fix);
    return;
  }

  // 2. Load and validate config
  let configDir: string;
  try {
    const result = await loadConfig(configPath);
    configDir = result.configDir;
    checks.push({
      label: 'Config valid',
      status: 'ok',
      detail: `${result.config.properties.length} property(s), ${result.config.categories.length} categories`,
    });
  } catch (err) {
    checks.push({
      label: 'Config valid',
      status: 'fail',
      detail: err instanceof Error ? err.message : String(err),
    });
    await printAndFix(checks, options.fix);
    return;
  }

  const { config } = await loadConfig(configPath);

  // 3. .env.local
  const envLocalPath = path.join(configDir, '.env.local');
  const envExamplePath = path.join(configDir, '.env.example');
  if (await fileExists(envLocalPath)) {
    checks.push({ label: '.env.local', status: 'ok' });
  } else {
    checks.push({
      label: '.env.local',
      status: 'warn',
      detail: 'Not found. Copy .env.example to .env.local',
      fix: async () => {
        if (await fileExists(envExamplePath)) {
          await fs.copyFile(envExamplePath, envLocalPath);
          console.log(chalk.green(`    Created .env.local from .env.example`));
          console.log(chalk.yellow(`    Edit .env.local to add your ANTHROPIC_API_KEY`));
        } else {
          await fs.writeFile(envLocalPath, 'ANTHROPIC_API_KEY=sk-ant-your-key-here\n', 'utf-8');
          console.log(chalk.green(`    Created .env.local`));
          console.log(chalk.yellow(`    Edit .env.local to add your ANTHROPIC_API_KEY`));
        }
      },
    });
  }

  // 4. API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey && apiKey.startsWith('sk-ant-')) {
    checks.push({ label: 'API key', status: 'ok', detail: `sk-ant-...${apiKey.slice(-4)}` });
  } else if (apiKey) {
    checks.push({ label: 'API key', status: 'warn', detail: 'Set but unusual format' });
  } else {
    checks.push({
      label: 'API key',
      status: 'fail',
      detail: 'ANTHROPIC_API_KEY not set. Add it to .env.local',
    });
  }

  // 5. Model config
  const modelEnv = process.env.R2S_MODEL || 'medium';
  const resolvedModel = resolveModel();
  checks.push({
    label: 'Model',
    status: 'ok',
    detail: modelEnv in MODEL_ALIASES ? `${modelEnv} (${resolvedModel})` : resolvedModel,
  });

  // 6. Claude API connection
  if (apiKey) {
    try {
      const client = new Anthropic();
      const response = await client.messages.create({
        model: resolvedModel,
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Reply with just the word "ok"' }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      checks.push({
        label: 'API connection',
        status: 'ok',
        detail: `Model responded: "${text.trim()}"`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      checks.push({ label: 'API connection', status: 'fail', detail: msg.slice(0, 120) });
    }
  } else {
    checks.push({ label: 'API connection', status: 'fail', detail: 'Skipped (no API key)' });
  }

  // 7. Directories
  const dirs = [
    { label: 'Inbox directory', path: path.resolve(configDir, config.inbox) },
    { label: 'Processed directory', path: path.resolve(configDir, config.processed) },
    { label: '.r2s directory', path: path.join(configDir, '.r2s') },
  ];

  for (const dir of dirs) {
    if (await fileExists(dir.path)) {
      checks.push({ label: dir.label, status: 'ok', detail: dir.path });
    } else {
      const dirPath = dir.path;
      checks.push({
        label: dir.label,
        status: 'warn',
        detail: `${dirPath} (missing)`,
        fix: async () => {
          await ensureDir(dirPath);
          console.log(chalk.green(`    Created ${dirPath}`));
        },
      });
    }
  }

  // 8. Spreadsheet templates
  const year = currentYear();
  const spreadsheets = [
    {
      label: `Operating Expenses (${year})`,
      path: resolveSpreadsheetPath(configDir, config.spreadsheets.operating_expenses, year),
      template: 'Operating_Expenses.xlsx',
    },
    {
      label: 'Capital Improvements',
      path: resolveSpreadsheetPath(configDir, config.spreadsheets.capital_improvements, year),
      template: 'Capital_Improvements.xlsx',
    },
    {
      label: `Year-End Summary (${year})`,
      path: resolveSpreadsheetPath(configDir, config.spreadsheets.year_end_summary, year),
      template: 'Year_End_Summary.xlsx',
    },
  ];

  for (const ss of spreadsheets) {
    if (await fileExists(ss.path)) {
      checks.push({ label: ss.label, status: 'ok', detail: path.basename(ss.path) });
    } else {
      const ssPath = ss.path;
      const templateSrc = path.join(TEMPLATES_DIR, 'spreadsheets', ss.template);
      checks.push({
        label: ss.label,
        status: 'warn',
        detail: `${path.basename(ssPath)} (missing)`,
        fix: async () => {
          await copyTemplate(templateSrc, ssPath);
          console.log(chalk.green(`    Created ${path.basename(ssPath)}`));
        },
      });
    }
  }

  await printAndFix(checks, options.fix);
}

async function printAndFix(checks: Check[], fix?: boolean): Promise<void> {
  console.log();
  const fixable: Check[] = [];

  for (const check of checks) {
    const icon =
      check.status === 'ok'
        ? chalk.green('OK')
        : check.status === 'warn'
          ? chalk.yellow('!!')
          : chalk.red('XX');
    const fixTag = check.fix ? chalk.dim(' (fixable)') : '';
    const detail = check.detail ? chalk.dim(` ${check.detail}`) : '';
    console.log(`  ${icon} ${check.label}${detail}${fixTag}`);

    if (check.fix && check.status !== 'ok') {
      fixable.push(check);
    }
  }

  console.log();

  // Apply fixes if requested
  if (fix && fixable.length > 0) {
    console.log(chalk.cyan(`Fixing ${fixable.length} issue(s)...\n`));
    for (const check of fixable) {
      await check.fix!();
    }
    console.log();
  }

  const fails = checks.filter((c) => c.status === 'fail');
  const warns = checks.filter((c) => c.status === 'warn');

  if (fails.length > 0) {
    console.log(chalk.red(`${fails.length} issue(s) need attention.`));
  } else if (warns.length > 0) {
    console.log(chalk.green('Looking good!') + chalk.dim(` (${warns.length} minor warning(s))`));
    if (!fix && fixable.length > 0) {
      console.log(
        chalk.dim(`Run ${chalk.cyan('r2s doctor --fix')} to auto-fix ${fixable.length} issue(s).`),
      );
    }
  } else {
    console.log(chalk.green('Everything looks great!'));
  }
}
