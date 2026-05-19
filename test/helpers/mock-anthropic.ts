import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, '../fixtures/api-responses');

export function createMockAnthropicClient(responseJson: string) {
  return {
    messages: {
      create: async () => ({
        content: [{ type: 'text', text: responseJson }],
      }),
    },
  };
}

export async function loadApiResponse(name: string): Promise<string> {
  const filePath = path.join(FIXTURES_DIR, `${name}.json`);
  return await fs.readFile(filePath, 'utf-8');
}
