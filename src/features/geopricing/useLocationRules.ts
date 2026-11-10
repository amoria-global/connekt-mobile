/**
 * The state behind a LocationRulesField, for a screen that has one: the rules, the open new-rule row, whether the field is
 * open, the server's list of places, and the messages. The screen sends `payload` with the event, calls `blockSave` before
 * saving (a half-typed rule would be lost), and `showServerError` when the save is refused.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getGeoLocations } from './api';
import type { LocationsStatus } from './LocationRulesField';
import {
  OPEN_RULE_HINT,
  hasOpenDraft,
  ruleErrorIndex,
  toPayload,
  type GeoLocation,
  type LocationRule,
  type RuleDraft,
} from './locationRules';

export function useLocationRules(options: { initiallyOpen?: boolean } = {}) {
  const [stored, setStored] = useState<LocationRule[]>([]);
  const [draft, setDraft] = useState<RuleDraft | null>(null);
  const [expanded, setExpanded] = useState(options.initiallyOpen ?? false);
  const [message, setMessage] = useState<string | null>(null);
  const [ruleErrors, setRuleErrors] = useState<Record<number, string>>({});
  const [locations, setLocations] = useState<GeoLocation[]>([]);
  const [status, setStatus] = useState<LocationsStatus>('loading');

  // The list of places is fetched once, when the field is first opened. A retry sets 'loading' again, which fetches again.
  useEffect(() => {
    if (!expanded || status !== 'loading' || locations.length > 0) return;
    let live = true;
    getGeoLocations()
      .then((list) => {
        if (!live) return;
        setLocations([...list.countries, ...list.continents]);
        setStatus('ready');
      })
      .catch(() => {
        if (live) setStatus('error');
      });
    return () => {
      live = false;
    };
  }, [expanded, status, locations.length]);

  // A saved rule only knows its code; its name comes from the list of places once that is here.
  const rules = useMemo(
    () =>
      locations.length === 0
        ? stored
        : stored.map((r) => {
            const hit = locations.find((l) => l.scopeType === r.scopeType && l.code === r.scopeValue);
            return hit && hit.name !== r.label ? { ...r, label: hit.name } : r;
          }),
    [stored, locations],
  );

  /** Puts the saved rules into the field, without the "edited" side effects of a user change. */
  const hydrate = useCallback((saved: LocationRule[]) => setStored(saved), []);

  const setRules = useCallback((next: LocationRule[]) => {
    setStored(next);
    setMessage(null);
    setRuleErrors({});
  }, []);

  const onDraftChange = useCallback((d: RuleDraft | null) => {
    setDraft(d);
    if (d == null || !hasOpenDraft(d)) setMessage(null);
  }, []);

  /** True (and the field says why) when a rule is half typed: the save must wait. */
  const blockSave = useCallback((): boolean => {
    if (!hasOpenDraft(draft)) return false;
    setExpanded(true);
    setMessage(OPEN_RULE_HINT);
    return true;
  }, [draft]);

  /** Opens the field and puts the server's refusal on the rule it names (or under the field when it names none). */
  const showServerError = useCallback((field: string | undefined, text: string) => {
    const bad = ruleErrorIndex(field);
    setExpanded(true);
    if (bad) setRuleErrors({ [bad.index]: text });
    else setMessage(text);
  }, []);

  return {
    rules,
    setRules,
    hydrate,
    draft,
    onDraftChange,
    expanded,
    toggle: () => setExpanded((v) => !v),
    message,
    ruleErrors,
    locations,
    status,
    retry: () => setStatus('loading'),
    payload: () => toPayload(rules),
    blockSave,
    showServerError,
  };
}
