import { execFileSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * The OTA gate checks each platform against the build it actually runs. iOS shipped 2.3.2 from a
 * different commit than Android's 2.3.1, and a single baseline made every iOS update look unsafe
 * (or, worse, an Android-safe branch look safe for iOS). These run the real script in a throwaway
 * git repo shaped like that situation.
 */
const SCRIPT = path.join(__dirname, '..', '..', 'scripts', 'check-ota-compatibility.mjs');

let dir: string;

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
}

function write(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  fs.writeFileSync(path.join(dir, file), JSON.stringify(value, null, 2));
}

function app(version: string, ios: object = {}) {
  return { expo: { version, runtimeVersion: { policy: 'appVersion' }, plugins: ['expo-font'], scheme: 'x', ios } };
}

function commit(message: string): string {
  git('add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', message);
  return git('rev-parse', 'HEAD');
}

function gate(...args: string[]) {
  const r = spawnSync('node', [SCRIPT, ...args], { cwd: dir, encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

let androidCommit: string;
let iosCommit: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ota-gate-'));
  git('init', '-q');
  const pkg = { dependencies: { 'expo-font': '1.0.0' } };

  write('package.json', pkg);
  write('app.json', app('2.3.1'));
  androidCommit = commit('android build 2.3.1');

  // iOS 2.3.2 added universal links, a native change Android never shipped.
  write('app.json', app('2.3.2', { associatedDomains: ['applinks:example.com'] }));
  iosCommit = commit('ios build 2.3.2');

  write('.eas/production-baseline.json', {
    buildCommit: androidCommit,
    appVersion: '2.3.1',
    ios: { buildCommit: iosCommit, appVersion: '2.3.2' },
  });
});

afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('ota gate per platform', () => {
  it('defaults to android and passes a branch at the android version', () => {
    write('app.json', app('2.3.1'));
    commit('js only at 2.3.1');
    const r = gate();
    expect(r.code).toBe(0);
    expect(r.out).toContain('android');
  });

  it('refuses an iOS update from a branch at the android version', () => {
    write('app.json', app('2.3.1'));
    commit('js only at 2.3.1');
    const r = gate('--platform', 'ios');
    expect(r.code).toBe(1);
    expect(r.out).toContain('installed ios phones run 2.3.2');
    expect(r.out).toContain('ios.associatedDomains');
  });

  it('passes an iOS update from a branch at the iOS version', () => {
    write('src/x.json', { js: true });
    commit('js only on the ios build');
    const r = gate('--platform', 'ios');
    expect(r.code).toBe(0);
    expect(r.out).toContain('matches the installed ios build');
  });

  it('refuses android for a branch at the iOS version, and "all" needs both to pass', () => {
    write('src/x.json', { js: true });
    commit('js only on the ios build');
    expect(gate('--platform', 'android').code).toBe(1);
    expect(gate('--platform', 'all').code).toBe(1);
  });

  it('an android-only native change does not fail the iOS check, and a dependency change fails both', () => {
    write('app.json', app('2.3.2', { associatedDomains: ['applinks:example.com'] }));
    const a = JSON.parse(fs.readFileSync(path.join(dir, 'app.json'), 'utf8'));
    a.expo.android = { permissions: ['CAMERA'] };
    write('app.json', a);
    commit('android permission');
    expect(gate('--platform', 'ios').code).toBe(0);

    write('package.json', { dependencies: { 'expo-font': '2.0.0' } });
    commit('bump a runtime dependency');
    expect(gate('--platform', 'ios').out).toContain('expo-font');
    expect(gate('--platform', 'ios').code).toBe(1);
  });

  it('stops with a clear message when the baseline has no iOS build', () => {
    write('.eas/production-baseline.json', { buildCommit: androidCommit, appVersion: '2.3.1' });
    const r = gate('--platform', 'ios');
    expect(r.code).toBe(2);
    expect(r.out).toContain('no iOS build');
  });

  it('rejects an unknown platform', () => {
    const r = gate('--platform', 'web');
    expect(r.code).toBe(2);
    expect(r.out).toContain('Unknown platform');
  });
});
