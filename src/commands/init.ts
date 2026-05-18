import fs from 'fs/promises';
import path from 'path';
import { input, select, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { ensureDir, fileExists } from '../utils/files.js';
import { currentYear } from '../utils/dates.js';
import { copyTemplate } from '../core/spreadsheet.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

interface InitOptions {
  property?: string;
  year?: number;
}

export async function initCommand(options: InitOptions): Promise<void> {
  const cwd = process.cwd();
  const configPath = path.join(cwd, 'r2s.yaml');

  if (await fileExists(configPath)) {
    console.log(chalk.yellow('r2s.yaml already exists in this directory.'));
    const overwrite = await confirm({
      message: 'Overwrite existing configuration?',
      default: false,
    });
    if (!overwrite) {
      console.log('Aborted.');
      return;
    }
  }

  // Gather property info
  let propertyName = options.property;
  let propertyId: string;

  if (!propertyName) {
    const answeredName = await input({ message: 'Property name:', default: 'My Rental Property' });
    const answeredLocation = await input({
      message: 'Location (City, State):',
      default: 'City, State',
    });
    const answeredType = await select({
      message: 'Property type:',
      choices: [
        { name: 'Short-term rental (Airbnb, VRBO)', value: 'short-term-rental' as const },
        { name: 'Long-term rental', value: 'long-term-rental' as const },
      ],
    });
    const answers = { propertyName: answeredName, location: answeredLocation, type: answeredType };
    propertyName = answers.propertyName;
    propertyId = slugify(answers.propertyName);

    // Build config from template with user's answers
    const templateConfig = await fs.readFile(path.join(TEMPLATES_DIR, 'r2s.yaml'), 'utf-8');
    const config = templateConfig
      .replace('my-property', propertyId)
      .replace('"My Rental Property"', `"${answers.propertyName}"`)
      .replace('"City, State"', `"${answers.location}"`)
      .replace('short-term-rental    # short-term-rental | long-term-rental', `${answers.type}`)
      .replace('default_property: my-property', `default_property: ${propertyId}`);

    await fs.writeFile(configPath, config, 'utf-8');
  } else {
    propertyId = slugify(propertyName);
    const templateConfig = await fs.readFile(path.join(TEMPLATES_DIR, 'r2s.yaml'), 'utf-8');
    const config = templateConfig
      .replace('my-property', propertyId)
      .replace('"My Rental Property"', `"${propertyName}"`)
      .replace('default_property: my-property', `default_property: ${propertyId}`);

    await fs.writeFile(configPath, config, 'utf-8');
  }

  // Create directories
  await ensureDir(path.join(cwd, 'inbox'));
  await ensureDir(path.join(cwd, 'processed'));
  await ensureDir(path.join(cwd, 'spreadsheets'));
  await ensureDir(path.join(cwd, '.r2s'));

  // Copy spreadsheet templates
  const year = options.year || currentYear();
  const spreadsheetTemplates = [
    { src: 'Operating_Expenses.xlsx', dest: `Operating_Expenses_${year}.xlsx` },
    { src: 'Capital_Improvements.xlsx', dest: 'Capital_Improvements.xlsx' },
    { src: 'Year_End_Summary.xlsx', dest: `Year_End_Summary_${year}.xlsx` },
  ];

  for (const tmpl of spreadsheetTemplates) {
    const srcPath = path.join(TEMPLATES_DIR, 'spreadsheets', tmpl.src);
    const destPath = path.join(cwd, 'spreadsheets', tmpl.dest);

    if (await fileExists(destPath)) {
      console.log(chalk.dim(`  Skipping ${tmpl.dest} (already exists)`));
    } else {
      await copyTemplate(srcPath, destPath);
      console.log(chalk.green(`  Created spreadsheets/${tmpl.dest}`));
    }
  }

  // Create empty vendor cache
  const vendorCachePath = path.join(cwd, '.r2s', 'vendor-cache.json');
  if (!(await fileExists(vendorCachePath))) {
    await fs.writeFile(vendorCachePath, '{}', 'utf-8');
  }

  console.log();
  console.log(chalk.green.bold('receipt2sheet initialized!'));
  console.log();
  console.log(`  Property: ${propertyName}`);
  console.log(`  Config:   r2s.yaml`);
  console.log(`  Inbox:    inbox/`);
  console.log();
  console.log(`Drop receipts in ${chalk.cyan('inbox/')} and run ${chalk.cyan('r2s process')}`);
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
