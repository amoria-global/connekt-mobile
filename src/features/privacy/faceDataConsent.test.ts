/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';

/**
 * App Review, Guideline 2.1 / 5.1.1 (face data).
 *
 * On 2026-09-24 Apple held iOS 2.2.0 (13) until we explained how face data is
 * collected, shared, stored and deleted, with privacy policy quotes. Our reply
 * promised that a consent prompt precedes every face capture and named AWS as
 * the only processor. This test keeps the app to that promise, so a new face
 * feature fails here instead of in App Review. See docs/FACE_DATA.md.
 */
const SRC = path.join(__dirname, '..', '..');

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [full] : [];
  });
}

const rel = (f: string) => path.relative(SRC, f).split(path.sep).join('/');
const files = walk(SRC).map((f) => ({ file: rel(f), text: fs.readFileSync(f, 'utf8') }));

// Calls that capture a face or send one to the backend.
const FACE_CAPTURE = /\b(takeSelfie|takeSelfieDataUrl|faceSearch|submitKyc)\s*\(/;
const CONSENT_GATE = /\bensure(Face|Kyc|WithdrawalFace)Consent\s*\(/;

// Where these functions are defined, not called by a screen.
const DEFINITIONS = new Set(['services/imagePicker.ts', 'features/photos/api.ts', 'features/kyc/api.ts']);

// Captures that run only inside a flow a gate has already opened.
const GATED_BY_PARENT: Record<string, { parent: string; gate: RegExp }> = {
  'features/kyc/LiveSelfieVerification.tsx': {
    parent: 'features/kyc/KycVerifyFlow.tsx',
    gate: /ensureKycConsent\s*\(/,
  },
};

// API modules allowed to send a selfie or face image. A new one means a new
// face data path: update docs/FACE_DATA.md, the privacy policy and the App
// Review Notes first, then add it here.
const FACE_UPLOAD_MODULES = [
  'features/kyc/api.ts',
  'features/photos/api.ts',
  'features/withdrawals/api.ts',
  'features/withdrawals/model.ts',
];

describe('face data consent', () => {
  it('every screen that captures or uploads a face asks for consent first', () => {
    const ungated = files
      .filter(({ file, text }) => !DEFINITIONS.has(file) && FACE_CAPTURE.test(text))
      .filter(({ file, text }) => {
        if (CONSENT_GATE.test(text)) return false;
        const via = GATED_BY_PARENT[file];
        const parent = via && files.find((f) => f.file === via.parent);
        return !(parent && via.gate.test(parent.text) && parent.text.includes(path.basename(file, '.tsx')));
      })
      .map(({ file }) => file);
    expect(ungated).toEqual([]);
  });

  it('every consent text names the processor, as the privacy policy does', () => {
    const consent = files.find((f) => f.file === 'features/privacy/consent.ts')!.text;
    const gates = consent.split(/export async function /).slice(1);
    expect(gates.map((g) => g.slice(0, g.indexOf('('))).sort()).toEqual([
      'ensureFaceConsent',
      'ensureKycConsent',
      'ensureWithdrawalFaceConsent',
    ]);
    for (const g of gates) expect(g).toContain('Amazon Web Services (AWS)');
  });

  it('only the known API modules send a selfie', () => {
    const senders = files
      .filter(({ file }) => /^features\/[^/]+\/(api|model)\.ts$/.test(file))
      .filter(({ text }) => /\bselfie\b/i.test(text))
      .map(({ file }) => file)
      .sort();
    expect(senders).toEqual([...FACE_UPLOAD_MODULES].sort());
  });
});
