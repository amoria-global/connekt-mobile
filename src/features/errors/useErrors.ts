import type { ActionId } from './catalogue';
import { presentError, type ErrorContext, type Presentation } from './presentError';
import { reportError } from './report';
import { openSheet, setBanner, showToast } from './store';

/**
 * What a screen calls when something failed:
 *
 *   const { showError } = useErrors();
 *   try { await save(); } catch (e) { showError(e, { intent: 'save' }, { onRetry: save }); }
 *
 * The hook asks `presentError` how loud to be, reports the failure with its support code, and shows the right
 * component. A 'field' result is returned, not shown: the screen owns the input, so it sets the FieldError, focuses the
 * field and scrolls to it. A 'fullscreen' result is returned too, for the screen to render `FullScreenError` in place of
 * its content. 'signin' goes to `handlers.onSignIn` so the screen keeps the person's place.
 */
export type ErrorHandlers = {
  onRetry?: () => void;
  /** Any other action the presentation offers: 'home', 'back', 'change-method', 'sign-in', 'contact-support', 'resend'. */
  onAction?: (id: ActionId) => void;
  onSignIn?: () => void;
  /** Where the failure happened, for the report: "album.create". No user data. */
  where?: string;
};

export function showError(error: unknown, ctx: ErrorContext = {}, handlers: ErrorHandlers = {}): Presentation {
  const presentation = presentError(error, ctx);
  // Validation the person can fix on the field is not an incident, so it is not reported.
  if (presentation.kind !== 'field') reportError(error, presentation, handlers.where);

  const act = (id: ActionId) => {
    if (id === 'retry') handlers.onRetry?.();
    else if (id === 'sign-in') (handlers.onSignIn ?? (() => handlers.onAction?.(id)))();
    else handlers.onAction?.(id);
  };

  switch (presentation.kind) {
    case 'toast': {
      const retry = presentation.actions.find((a) => a.id === 'retry');
      showToast({
        message: presentation.title && presentation.message ? `${presentation.title}. ${presentation.message}` : presentation.message || presentation.title,
        tone: presentation.tone,
        actionLabel: retry && handlers.onRetry ? retry.label : undefined,
        onAction: handlers.onRetry,
      });
      break;
    }
    case 'banner':
      setBanner({
        key: 'connectivity',
        tone: 'warning',
        title: presentation.title,
        message: presentation.message,
        actionLabel: handlers.onRetry ? 'Try again' : undefined,
        onAction: handlers.onRetry,
      });
      break;
    case 'sheet':
      openSheet({ presentation, onAction: act });
      break;
    case 'signin':
      (handlers.onSignIn ?? (() => handlers.onAction?.('sign-in')))();
      break;
    default:
      break; // 'field' and 'fullscreen' are the screen's to render
  }
  return presentation;
}

/** `showError` is a module function and never changes, so there is nothing to memoise. */
export function useErrors() {
  return { showError };
}
