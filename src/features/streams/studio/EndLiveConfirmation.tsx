import { ConfirmDialog } from './ConfirmDialog';

type Props = {
  visible: boolean;
  busy: boolean;
  onContinue: () => void;
  onEnd: () => void;
};

/** Protects against accidental taps; confirm runs the existing stop handler. */
export function EndLiveConfirmation({ visible, busy, onContinue, onEnd }: Props) {
  return (
    <ConfirmDialog
      visible={visible}
      title="End LIVE?"
      message="Your current broadcast will stop and viewers will be disconnected."
      cancelLabel="Continue Streaming"
      confirmLabel="End LIVE"
      onCancel={onContinue}
      onConfirm={onEnd}
      busy={busy}
    />
  );
}
