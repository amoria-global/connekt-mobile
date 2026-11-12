import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * No secret may be committed to this repository, which is PUBLIC.
 *
 * Why this exists: on 2026-11-08 a Google Maps API key was committed as a default in src/config/env.ts and GitGuardian
 * reported it. The key answered Geocoding and Places for anyone, and because the repo is public it had to be revoked,
 * not just deleted from the code. Anything shipped inside an app can also be unpacked, so a server-side key belongs on
 * the backend (place search now goes through /public/places). This test fails the build before that can reach `main`.
 *
 * It scans every tracked text file for strings shaped like real credentials. GitHub secret scanning and push
 * protection should also be on (Settings, Code security), but this runs on every test run and in CI.
 *
 * The allowlist is for files that must contain a value that looks like a key. Add to it only with a written reason.
 */
const ROOT = path.join(__dirname, '..', '..');

const ALLOWLIST: Record<string, string> = {
  'GoogleService-Info.plist':
    'Firebase iOS client config. These keys ship in every app by design. They are protected by restricting them to this app (bundle id and Firebase APIs only) in Google Cloud, not by hiding them.',
  'google-services.json':
    'Firebase Android client config. Same as above: restricted to the package and SHA-1 in Google Cloud, not secret.',
};

const RULES: { name: string; pattern: RegExp }[] = [
  { name: 'Google API key', pattern: /AIza[0-9A-Za-z_-]{35}/ },
  { name: 'private key block', pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/ },
  { name: 'service-account private key', pattern: /"private_key"\s*:\s*"-----BEGIN/ },
  { name: 'GitHub token', pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/ },
  { name: 'AWS access key id', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'Slack token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: 'Stripe live key', pattern: /\b[sr]k_live_[0-9A-Za-z]{20,}/ },
  { name: 'Sentry auth token', pattern: /\bsntry[su]_[A-Za-z0-9+/=_-]{40,}/ },
  { name: 'Sentry auth token assignment', pattern: /SENTRY_AUTH_TOKEN\s*[:=]\s*['"]?[A-Za-z0-9]{32,}/ },
];

function trackedFiles(): string[] {
  try {
    const out = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return out.split('\0').filter(Boolean);
  } catch {
    return []; // not a git checkout (an unpacked archive): nothing to enumerate
  }
}

function readText(rel: string): string | null {
  const full = path.join(ROOT, rel);
  try {
    const stat = fs.statSync(full);
    if (!stat.isFile() || stat.size > 2_000_000) return null;
    const buf = fs.readFileSync(full);
    return buf.includes(0) ? null : buf.toString('utf8'); // skip binaries
  } catch {
    return null;
  }
}

describe('no committed secrets', () => {
  const files = trackedFiles().filter((f) => !/(^|\/)(yarn\.lock|package-lock\.json)$/.test(f));

  it('finds no credential-shaped string in any tracked file (outside the documented allowlist)', () => {
    const offenders: string[] = [];
    for (const rel of files) {
      if (ALLOWLIST[rel]) continue;
      const text = readText(rel);
      if (text === null) continue;
      for (const rule of RULES) {
        if (rule.pattern.test(text)) offenders.push(`${rel}: ${rule.name}`);
      }
    }
    // Names the file and the kind of secret, never the value.
    expect(offenders).toEqual([]);
  });

  it('keeps every allowlisted file justified and still present', () => {
    for (const [rel, reason] of Object.entries(ALLOWLIST)) {
      expect(reason.length).toBeGreaterThan(40);
      expect(files).toContain(rel);
    }
  });

  it('recognises each kind of secret it is meant to catch', () => {
    const samples: Record<string, string> = {
      'Google API key': 'AIza' + 'A'.repeat(35),
      'private key block': '-----BEGIN ' + 'PRIVATE KEY-----',
      'GitHub token': 'ghp_' + 'a'.repeat(36),
      'AWS access key id': 'AKIA' + 'A'.repeat(16),
      'Slack token': 'xoxb-' + '1'.repeat(12),
      'Stripe live key': 'sk_live_' + 'a'.repeat(24),
      'Sentry auth token assignment': 'SENTRY_AUTH_TOKEN=' + 'a'.repeat(40),
    };
    for (const [name, sample] of Object.entries(samples)) {
      const rule = RULES.find((r) => r.name === name)!;
      expect(rule.pattern.test(sample)).toBe(true);
    }
  });
});
