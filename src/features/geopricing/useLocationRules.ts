/**
 * The state behind a LocationRulesField, for a screen that has one: the rules, the open new-rule row, whether the field is
 * open, the server's list of places, and the messages. The screen sends `payload` with the event, calls `blockSave` before
 * saving (a half-typed rule would be lost), and `showServerError` when the save is refused.
 */
import { useCallback, useEffect, useState } from 'react';
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

export function useLocationRules() {
  const [rules, setRulesState] = useState<LocationRule[]>([]);
  const [draft, setDraft] = useState<RuleDraft | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ruleErrors, setRuleErrors] = useState<Record<number, string>>({});
  const [locations, setLocations] = useState<GeoLocation[]>([]);
  const [status, setStatus] = useState<LocationsStatus>('loading');

  const load = useCallback(() => {
    setStatus('loading');
    getGeoLocations()
      .then((list) => {
        setLocations([...list.countries, ...list.continents]);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  // The list is only fetched once the field is opened.
  useEffect(() => {
    if (expanded && status === 'loading' && locations.length === 0) load();
  }, [expanded, status, locations.length, load]);

  const setRules = useCallback((next: LocationRule[]) => {
    setRulesState(next);
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
    draft,
    onDraftChange,
    expanded,
    toggle: () => setExpanded((v) => !v),
    message,
    ruleErrors,
    locations,
    status,
    retry: load,
    payload: () => toPayload(rules),
    blockSave,
    showServerError,
  };
}
