/// <reference types="node" />
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { withdrawalMethodsPath } from '../paymentAccounts/model';
import { withdrawNamespace } from '../withdrawals/model';

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

function callsIn(relFile: string, rewrite: (src: string) => string = (src) => src): Call[] {
  const src = rewrite(readFileSync(path.join(ROOT, relFile), 'utf8'));
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
});

/**
 * Payment accounts (withdrawal methods). The paths are built per role by
 * withdrawalMethodsPath, so the extractor above cannot see them; resolve them
 * for every role here and check each verb the screen uses. The mobile withdraw
 * screen used to read the photographer path for every role.
 */
describe('mobile payment accounts against the backend contract', () => {
  const ROLES = ['Photographer', 'Coordinator', 'Client', 'Viewer', undefined] as const;
  const withId = (p: string) => `${p}/00000000-0000-0000-0000-000000000000`;

  it.each(ROLES)('every withdrawal-methods call exists for role %s', (role) => {
    const base = '/api/remote' + withdrawalMethodsPath(role);
    const wanted: Call[] = [
      { method: 'GET', path: base, source: 'list' },
      { method: 'POST', path: base, source: 'add' },
      { method: 'PUT', path: withId(base), source: 'set default' },
      { method: 'DELETE', path: withId(base), source: 'remove' },
    ];
    expect(wanted.filter((c) => !matches(c))).toEqual([]);
  });

  it('the provider list and the name lookup exist', () => {
    // The withdrawal-methods calls start with a template hole and are checked
    // per role above; keep the literal xentripay ones.
    const calls = callsIn('src/features/paymentAccounts/api.ts').filter((c) => c.path.includes('/xentripay/'));
    const paths = calls.map((c) => `${c.method} ${c.path}`);
    expect(paths).toContain('GET /api/remote/withdrawals/xentripay/providers');
    expect(paths).toContain('POST /api/remote/withdrawals/xentripay/validate-account-details');
    expect(calls.filter((c) => !matches(c))).toEqual([]);
  });
});

/**
 * The withdraw flow. The old screen posted to /api/remote/withdrawals, which
 * the backend has never had; these would have caught it.
 */
describe('mobile withdraw flow against the backend contract', () => {
  const ROLES = ['Photographer', 'Coordinator', 'Client', undefined] as const;

  it.each(ROLES)('every withdraw call exists for role %s', (role) => {
    const ns = '/api/remote/' + withdrawNamespace(role);
    const wanted: Call[] = [
      { method: 'GET', path: `${ns}/withdrawable-sources`, source: 'sources' },
      { method: 'POST', path: `${ns}/withdraw/initiate`, source: 'initiate' },
      { method: 'POST', path: `${ns}/withdraw/verify`, source: 'verify' },
      { method: 'POST', path: `${ns}/withdraw/resend-otp`, source: 'resend' },
    ];
    expect(wanted.filter((c) => !matches(c))).toEqual([]);
  });

  it('the currency rates exist, and the client never calls the payout endpoint', () => {
    // Paths starting with a template hole are the per-role ones checked above.
    const literal = callsIn('src/features/withdrawals/api.ts').filter((c) => !c.path.startsWith('/api/remote/X'));
    expect(literal.map((c) => `${c.method} ${c.path}`)).toContain('GET /api/remote/public/currencies/rates');
    expect(literal.filter((c) => !matches(c))).toEqual([]);
    // A verified withdrawal is PENDING_APPROVAL and /xentripay/process refuses it.
    const src = readFileSync(path.join(ROOT, 'src/features/withdrawals/api.ts'), 'utf8');
    expect(src).not.toContain('xentripay/process');
    expect(src).not.toMatch(/'\/withdrawals'/);
  });
});

describe('contract copy', () => {
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

/**
 * Album collaboration replaced the Team. Its client builds every path on a
 * BASE constant, so substitute it before extracting. Both the owner side
 * (review, invite, remove) and the collaborator side (join, submit, leave)
 * must hit routes the backend has.
 */
describe('mobile album collaboration against the backend contract', () => {
  const calls = callsIn('src/features/collab/api.ts', (src) => src.replace(/\$\{BASE\}/g, '/photographer/collab'));

  it('finds both sides of the workflow', () => {
    const paths = calls.map((c) => `${c.method} ${c.path}`);
    expect(paths).toContain('POST /api/remote/photographer/collab/albums/X/invites');
    expect(paths).toContain('POST /api/remote/photographer/collab/submissions/review');
    expect(paths).toContain('POST /api/remote/photographer/collab/invites/X/accept');
    expect(paths).toContain('POST /api/remote/photographer/collab/joined/X/submissions');
    expect(paths).toContain('DELETE /api/remote/photographer/collab/links/X');
    expect(paths.length).toBe(13);
  });

  it('every collaboration path exists on the backend', () => {
    expect(calls.filter((c) => !matches(c)).map((c) => `${c.method} ${c.path}`)).toEqual([]);
  });

  it('nothing calls the retired Team management routes', () => {
    expect(existsSync(path.join(ROOT, 'src/features/teams'))).toBe(false);
    expect(existsSync(path.join(ROOT, 'src/app/(app)/team'))).toBe(false);
  });
});

/**
 * Dedicated role endpoints: Photographer Payments, Coordinator Clients,
 * and single-item detail routes.
 */
describe('dedicated role endpoints against the backend contract', () => {
  it('every role-specific payment endpoint exists on the backend', () => {
    const paymentCalls = [
      { method: 'GET', path: '/api/remote/customer/payments', source: 'payments' },
      { method: 'GET', path: '/api/remote/customer/payments/X', source: 'payments' },
      { method: 'GET', path: '/api/remote/coordinator/payments', source: 'payments' },
      { method: 'GET', path: '/api/remote/coordinator/payments/X', source: 'payments' },
      { method: 'GET', path: '/api/remote/photographer/payments', source: 'payments' },
      { method: 'GET', path: '/api/remote/photographer/payments/X', source: 'payments' },
    ];
    expect(paymentCalls.filter((c) => !matches(c)).map((c) => `${c.method} ${c.path}`)).toEqual([]);
  });

  it('every client CRM endpoint exists for both Photographers and Coordinators', () => {
    const clientCalls = [
      { method: 'GET', path: '/api/remote/photographer/clients', source: 'clients' },
      { method: 'GET', path: '/api/remote/photographer/clients/X', source: 'clients' },
      { method: 'GET', path: '/api/remote/coordinator/clients', source: 'clients' },
      { method: 'GET', path: '/api/remote/coordinator/clients/X', source: 'clients' },
    ];
    expect(clientCalls.filter((c) => !matches(c)).map((c) => `${c.method} ${c.path}`)).toEqual([]);
  });

  it('in-stream tipping route exists on the backend', () => {
    const tipCalls = [
      { method: 'POST', path: '/api/remote/streams/X/tip', source: 'streams' },
    ];
    expect(tipCalls.filter((c) => !matches(c)).map((c) => `${c.method} ${c.path}`)).toEqual([]);
  });
});
