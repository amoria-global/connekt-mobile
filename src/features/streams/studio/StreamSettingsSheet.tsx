import { BottomSheet } from './BottomSheet';
import { SheetRow, SheetSection } from './SheetParts';
import type { CameraFacing } from '@/features/streams/CameraPublisher';

type Props = {
  visible: boolean;
  onClose: () => void;
  eventTitle: string;
  mode: 'browser' | 'obs';
  onModeChange: (m: 'browser' | 'obs') => void;
  isLive: boolean;
  isPaused: boolean;
  busy: string | null;
  micOff: boolean;
  camOff: boolean;
  facing: CameraFacing;
  cleanView: boolean;
  inviteToken?: string;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onFlip: () => void;
  onToggleCleanView: (v: boolean) => void;
  onPause: () => void;
  onResume: () => void;
  onShare: () => void;
  onShareInvite: () => void;
  onOpenInfo: () => void;
  onOpenObs: () => void;
};

/**
 * Every existing creator setting in one place, grouped, opened with one tap
 * from the live screen. Nothing here is new functionality: each row calls the
 * handler the previous screen already used.
 */
export function StreamSettingsSheet({
  visible,
  onClose,
  eventTitle,
  mode,
  onModeChange,
  isLive,
  isPaused,
  busy,
  micOff,
  camOff,
  facing,
  cleanView,
  inviteToken,
  onToggleMic,
  onToggleCam,
  onFlip,
  onToggleCleanView,
  onPause,
  onResume,
  onShare,
  onShareInvite,
  onOpenInfo,
  onOpenObs,
}: Props) {
  const phone = mode === 'browser';
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Stream settings">
      <SheetSection title="Stream">
        <SheetRow icon="radio" label="Live title" value={eventTitle} onPress={onOpenInfo} />
        <SheetRow icon="paper-plane-outline" label="Share live link" onPress={onShare} />
        {inviteToken ? (
          <SheetRow icon="key-outline" label="Viewer access code" value={inviteToken} onPress={onShareInvite} />
        ) : null}
        <SheetRow icon="stats-chart-outline" label="Stream info & stats" onPress={onOpenInfo} last />
      </SheetSection>

      <SheetSection title="Camera">
        <SheetRow
          icon="swap-horizontal"
          label="Video source"
          value={phone ? 'This phone' : 'External / OBS'}
          onPress={() => onModeChange(phone ? 'obs' : 'browser')}
          hint={phone ? 'Tap to switch to an external encoder' : 'Tap to switch back to this phone'}
        />
        {phone ? (
          <>
            <SheetRow
              icon="camera-reverse-outline"
              label="Flip camera"
              value={facing === 'user' ? 'Front' : 'Back'}
              onPress={onFlip}
            />
            <SheetRow
              icon={camOff ? 'videocam-off-outline' : 'videocam-outline'}
              label="Video"
              toggle={{ value: !camOff, onChange: () => onToggleCam() }}
              value={camOff ? 'Off' : 'On'}
            />
          </>
        ) : (
          <SheetRow icon="desktop-outline" label="OBS / encoder setup" onPress={onOpenObs} />
        )}
      </SheetSection>

      {phone ? (
        <SheetSection title="Audio">
          <SheetRow
            icon={micOff ? 'mic-off-outline' : 'mic-outline'}
            label="Microphone"
            toggle={{ value: !micOff, onChange: () => onToggleMic() }}
            value={micOff ? 'Off' : 'On'}
            last
          />
        </SheetSection>
      ) : null}

      <SheetSection title="Interaction">
        <SheetRow
          icon="eye-off-outline"
          label="Clean view"
          hint="Hide comments and reactions on your screen only"
          toggle={{ value: cleanView, onChange: onToggleCleanView }}
          last
        />
      </SheetSection>

      {(isLive || isPaused) && (
        <SheetSection title="Broadcast">
          {isPaused ? (
            <SheetRow
              icon="play-circle-outline"
              label="Resume stream"
              onPress={onResume}
              disabled={busy !== null}
              last
            />
          ) : (
            <SheetRow
              icon="pause-circle-outline"
              label="Pause stream"
              hint="Viewers see a paused state until you resume"
              onPress={onPause}
              disabled={busy !== null}
              last
            />
          )}
        </SheetSection>
      )}
    </BottomSheet>
  );
}
