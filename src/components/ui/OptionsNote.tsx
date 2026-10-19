import { Pressable, Text } from "react-native";
import { fontSize, makeStyles } from "@/theme";

/**
 * Stands in for a chip group whose options came back empty or failed to load, so a labelled field never sits blank.
 * Tapping retries. Callers render it only when there are no options to show.
 */
export function OptionsNote({
  what,
  loading,
  onRetry,
}: {
  what: string;
  loading: boolean;
  onRetry: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onRetry}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={`Reload ${what}`}
      style={styles.note}
    >
      <Text style={styles.text}>
        {loading
          ? `Loading ${what}...`
          : `${what[0].toUpperCase()}${what.slice(1)} unavailable. Tap to retry.`}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  note: { minHeight: 44, justifyContent: "center" },
  text: { fontSize: fontSize.sm, color: c.textMuted },
}));
