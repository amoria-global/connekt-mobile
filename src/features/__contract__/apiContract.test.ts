/// <reference types="node" />
import { readFileSync, existsSync } from 'fs';
import path from 'path';

/**
 * CONN-TEST-4 for mobile: every backend path the auth and KYC clients call
 * must exist on the backend.
 *
 * This is the platform CONN-ONB-1 shipped on. The KYC client called
 * GET /customer/kyc when the route is /customer/kyc/status, and posted field
 * names the endpoint never read, and it produced real 404s in production
 * because nothing compared the request path with the routes the server has.
 *
 * contract/api-contract.json is generated from the backend's controllers by
 * ApiContractTest in amoria-connect and copied here by that repo's
 * scripts/sync-api-contract.sh.
 *
 * The auth and KYC client sources are read and every `api.<verb>(<path>)` is
 * extracted, rather than importing them: the real modules pull in the RN api
 * client and Expo, which a plain node test should not load. The client prepends
 * env.apiBaseUrl, which ends in /api/remote, to every path, so that prefix is
 * added here before matching.
 */

const ROOT = path.resolve(__dirname, '../../..');
const CONTRACT = path.join(ROOT, 'contract/api-contract.json');
const routes: { method: string; path: string }[] = JSON.parse(readFileSync(CONTRACT, 'utf8')).routes;

const templates = routes.map((r) => ({
  method: r.method,
  regex: new RegExp('^' + r.path.split(/\{[^}]*\}/).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]+') + '$'),
}));

/** Verb + concrete path (query and template holes removed), as it hits the wire. */
type Call = { method: string; path: string; source: string };

const VERB: Record<string, string> = { get: 'GET', post: 'POST', put: 'PUT', patch: 'PATCH', delete: 'DELETE' };

function callsIn(relFile: string): Call[] {
  const src = readFileSync(path.join(ROOT, relFile), 'utf8');
  const calls: Call[] = [];
  // api.get('...'), api.post(`...`, body), etc. First argument only.
  // (?:<[^()]*>)? allows nested generics like <ApiEnvelope<Raw>> before the (.
  const re = /\bapi\.(get|post|put|patch|delete)\s*(?:<[^()]*>)?\s*\(\s*([`'"])([^`'"]+)\2/g;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    const raw = m[3];
    const bare = raw.split('?')[0]; // drop query string
    const concrete = bare.replace(/\$\{[^}]*\}/g, 'X'); // template hole -> one segment
    calls.push({ method: VERB[m[1]], path: '/api/remote' + concrete, source: relFile });
  }
  return calls;
}

const calls = [
  ...callsIn('src/features/auth/api.ts'),
  ...callsIn('src/features/kyc/api.ts'),
];

const matches = (c: Call) =>
  templates.some((t) => (t.method === c.method || t.method === 'ANY') && t.regex.test(c.path));

describe('mobile auth + KYC requests against the backend contract', () => {
  it('finds the calls it is meant to check', () => {
    // A refactor that hides these behind a helper would make the checks below
    // vacuous. Assert the KYC status read and the core auth posts are seen.
    const paths = calls.map((c) => `${c.method} ${c.path}`);
    expect(paths).toContain('GET /api/remote/customer/kyc/status');
    expect(paths).toContain('POST /api/remote/auth/login');
    expect(paths.length).toBeGreaterThanOrEqual(8);
  });

  it('every auth and KYC path exists on the backend', () => {
    const missing = calls.filter((c) => !matches(c)).map((c) => `${c.method} ${c.path}  (${c.source})`);
    // CONN-ONB-1: GET /customer/kyc (no /status) would surface right here.
    expect(missing).toEqual([]);
  });

  it('reads the KYC status from /status, not the collection root', () => {
    const kyc = calls.filter((c) => c.path.includes('/customer/kyc'));
    expect(kyc).not.toHaveLength(0);
    for (const c of kyc) {
      // The exact mobile defect: GET /customer/kyc (no /status) does not exist.
      expect(c.path).not.toBe('/api/remote/customer/kyc');
      expect(matches(c)).toBe(true);
    }
  });

  // Jest has no it.skipIf, so gate with a plain conditional: this only runs on
  // a machine with the monorepo layout, and is a no-op in CI where the backend
  // is a different repository.
  const backendContract = path.join(ROOT, '../amoria-connect/src/test/resources/contract/api-contract.json');
  (existsSync(backendContract) ? it : it.skip)(
    'this copy of the contract matches the backend checked out next to it',
    () => {
      expect(readFileSync(CONTRACT, 'utf8') === readFileSync(backendContract, 'utf8')).toBe(true);
    },
  );
});
