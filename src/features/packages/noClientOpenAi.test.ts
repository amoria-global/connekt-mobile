import fs from 'fs';
import path from 'path';

/**
 * The OpenAI key lives on the server only. A key in the app ships to every phone inside the JavaScript bundle, so the
 * packages client must read brochures through the backend (/photographer/packages/ai-extract) and never call OpenAI
 * itself or carry a key, however it is split up.
 */
describe('packages client keeps OpenAI server-side', () => {
  const source = fs.readFileSync(path.join(__dirname, 'api.ts'), 'utf8');

  it('does not call the OpenAI API from the app', () => {
    expect(source).not.toMatch(/api\.openai\.com/);
    expect(source).not.toMatch(/chat\/completions/);
  });

  it('carries no API key, joined from pieces or otherwise', () => {
    expect(source).not.toMatch(/OPENAI_KEY/i);
    expect(source).not.toMatch(/sk-(proj-)?[A-Za-z0-9_-]{8,}/);
    expect(source).not.toMatch(/Authorization:\s*`?Bearer\s*\$\{/);
  });

  it('reads brochures through the backend endpoint', () => {
    expect(source).toContain('/photographer/packages/ai-extract');
  });
});
