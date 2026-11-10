/**
 * Location rules for an event: a price for a place, or a block on it. This file is the logic only (no UI), so the
 * form field, its tests and the payload all agree on what a rule is.
 *
 * Rules travel WITH the event (`geoRules` on create and update). The server checks every rule against its own list
 * and saves the event and its rules together, so a bad rule fails the whole save with a field error.
 *
 * Precedence the server applies, shown to the host in the field: country, then continent, then the default price.
 * At the same level a block beats a price.
 */
import type { GeoScope } from './api';

export type RuleAction = 'PRICE' | 'BLOCK';

/** One place a rule can name, as the server's list gives it. */
export type GeoLocation = {
  scopeType: GeoScope;
  code: string;
  name: string;
  /** Countries only: the continent's name, shown as a hint in the search results. */
  continentName?: string;
  countryCount?: number;
};

/** A rule as the form holds it. `key` is stable for a place, so a place can only appear once. */
export type LocationRule = {
  key: string;
  /** The saved rule's id, kept only so the dedicated screen can still address it. */
  id?: string;
  scopeType: GeoScope;
  scopeValue: string;
  label: string;
  action: RuleAction;
  /** Present for PRICE only. */
  price?: number;
  currencyId?: string;
  currencyCode?: string;
};

/** What the form is typing into the new-rule row. */
export type RuleDraft = {
  location: GeoLocation | null;
  action: RuleAction;
  /** The price as typed. Ignored for BLOCK. */
  priceText: string;
  currencyId?: string;
  currencyCode?: string;
};

/** The wire shape the server takes inside the event payload. */
export type GeoRulePayload = {
  scopeType: GeoScope;
  scopeValue: string;
  action: RuleAction;
  price?: number;
  currencyId?: string;
};

export const EMPTY_DRAFT: RuleDraft = { location: null, action: 'PRICE', priceText: '' };

export const ruleKey = (scopeType: GeoScope, code: string): string => `${scopeType}:${code.toUpperCase()}`;

/** The order the server resolves a viewer in; the field shows it as a one-line hint. */
export const PRECEDENCE_HINT = 'A country rule wins over its continent, and a continent over the default price. A block wins over a price in the same place.';

export function parsePrice(text: string): number | null {
  const t = text.trim().replace(/,/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Why the draft cannot be added yet, in words the host can act on; null when it can. */
export function draftProblem(draft: RuleDraft, rules: LocationRule[]): string | null {
  if (!draft.location) return 'Choose a country or continent first.';
  if (rules.some((r) => r.key === ruleKey(draft.location!.scopeType, draft.location!.code))) {
    return `${draft.location.name} already has a rule. Edit or remove it first.`;
  }
  if (draft.action === 'PRICE') {
    const p = parsePrice(draft.priceText);
    if (p == null) return 'Enter a price of 0 or more.';
    if (!draft.currencyId) return 'Choose a currency for the price.';
  }
  return null;
}

/** Turns a valid draft into a rule. Returns null when `draftProblem` would have refused it. */
export function ruleFromDraft(draft: RuleDraft, rules: LocationRule[]): LocationRule | null {
  if (draftProblem(draft, rules) || !draft.location) return null;
  const loc = draft.location;
  const base = {
    key: ruleKey(loc.scopeType, loc.code),
    scopeType: loc.scopeType,
    scopeValue: loc.code.toUpperCase(),
    label: loc.name,
  };
  if (draft.action === 'BLOCK') return { ...base, action: 'BLOCK' };
  return {
    ...base,
    action: 'PRICE',
    price: parsePrice(draft.priceText) ?? 0,
    currencyId: draft.currencyId,
    currencyCode: draft.currencyCode,
  };
}

/** The list the event save sends. A block carries no price; a price always does. */
export function toPayload(rules: LocationRule[]): GeoRulePayload[] {
  return rules.map((r) =>
    r.action === 'BLOCK'
      ? { scopeType: r.scopeType, scopeValue: r.scopeValue, action: 'BLOCK' }
      : {
          scopeType: r.scopeType,
          scopeValue: r.scopeValue,
          action: 'PRICE',
          price: r.price ?? 0,
          ...(r.currencyId ? { currencyId: r.currencyId } : {}),
        },
  );
}

/** Rules in the order a host reads them: countries first, then continents, each A to Z. */
export function sortRules(rules: LocationRule[]): LocationRule[] {
  const rank = (r: LocationRule) => (r.scopeType === 'COUNTRY' ? 0 : 1);
  return [...rules].sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label));
}

/** One line for a rule row: "Kenya, RWF 150" or "France, Blocked". No dashes, so it reads the same everywhere. */
export function describeRule(r: LocationRule): string {
  if (r.action === 'BLOCK') return `${r.label}, Blocked`;
  const amount = (r.price ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  return `${r.label}, ${r.currencyCode ? `${r.currencyCode} ` : ''}${amount}`;
}

/** What a row shows on its right: the price, or Blocked. */
export function ruleValue(r: LocationRule): string {
  if (r.action === 'BLOCK') return 'Blocked';
  const amount = (r.price ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  return `${r.currencyCode ? `${r.currencyCode} ` : ''}${amount}`;
}

/** The collapsed field's summary line. */
export function summarize(rules: LocationRule[]): string {
  if (rules.length === 0) return 'Same price everywhere';
  const blocked = rules.filter((r) => r.action === 'BLOCK').length;
  const priced = rules.length - blocked;
  const parts: string[] = [];
  if (priced) parts.push(`${priced} ${priced === 1 ? 'price' : 'prices'}`);
  if (blocked) parts.push(`${blocked} ${blocked === 1 ? 'blocked place' : 'blocked places'}`);
  return parts.join(', ');
}

/** True when the new-rule row holds something the host has not added yet, so saving should ask them to finish it. */
export function hasOpenDraft(draft: RuleDraft | null): boolean {
  if (!draft) return false;
  return !!draft.location || draft.priceText.trim().length > 0;
}

export const OPEN_RULE_HINT = 'Finish or cancel the open rule first.';

/**
 * Searches the server's list: matches the name or the code, countries and continents together, hides places that
 * already have a rule, and puts a name that starts with the query before one that merely contains it.
 */
export function searchLocations(all: GeoLocation[], query: string, rules: LocationRule[], limit = 40): GeoLocation[] {
  const taken = new Set(rules.map((r) => r.key));
  const q = query.trim().toLowerCase();
  const open = all.filter((l) => !taken.has(ruleKey(l.scopeType, l.code)));
  if (!q) return open.slice(0, limit);
  const scored: { l: GeoLocation; s: number }[] = [];
  for (const l of open) {
    const name = l.name.toLowerCase();
    const code = l.code.toLowerCase();
    let s = -1;
    if (name.startsWith(q) || code === q) s = 0;
    else if (name.split(/\s+/).some((w) => w.startsWith(q))) s = 1;
    else if (name.includes(q) || (l.continentName ?? '').toLowerCase().startsWith(q)) s = 2;
    if (s >= 0) scored.push({ l, s });
  }
  scored.sort((a, b) => a.s - b.s || a.l.name.localeCompare(b.l.name));
  return scored.slice(0, limit).map((x) => x.l);
}

/** A server error for a rule (`geoRules[2].price`) mapped to the rule it belongs to, so the row can show it. */
export function ruleErrorIndex(field: string | undefined): { index: number; part: string } | null {
  const m = /^geoRules\[(\d+)\]\.(\w+)$/.exec(field ?? '');
  return m ? { index: Number(m[1]), part: m[2] } : null;
}

/** A saved rule from the server, as the form holds it. The label is the code until the place list arrives. */
export function ruleFromServer(r: {
  id: string;
  scopeType: GeoScope;
  scopeValue: string;
  action?: RuleAction;
  price?: number;
  currencyId?: string;
  currencyAbbreviation?: string;
}): LocationRule {
  const block = r.action === 'BLOCK';
  return {
    key: ruleKey(r.scopeType, r.scopeValue),
    id: r.id,
    scopeType: r.scopeType,
    scopeValue: r.scopeValue,
    label: r.scopeValue,
    action: block ? 'BLOCK' : 'PRICE',
    price: block ? undefined : r.price,
    currencyId: r.currencyId,
    currencyCode: r.currencyAbbreviation,
  };
}

/**
 * What saving a manager screen has to do, one rule at a time: rules that are new or changed are upserted, and a saved rule
 * that is no longer in the form is deleted. (The event form does not need this; it sends the whole list with the event.)
 */
export function diffRules(saved: LocationRule[], next: LocationRule[]): { upserts: LocationRule[]; deletes: LocationRule[] } {
  const before = new Map(saved.map((r) => [r.key, r]));
  const after = new Set(next.map((r) => r.key));
  const upserts = next.filter((r) => {
    const old = before.get(r.key);
    return !old || old.action !== r.action || old.price !== r.price || (r.action === 'PRICE' && old.currencyId !== r.currencyId);
  });
  const deletes = saved.filter((r) => !after.has(r.key) && r.id);
  return { upserts, deletes };
}
