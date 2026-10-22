import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, TextInput, useTheme } from 'react-native-paper';

export function Screen({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>{children}</View>;
}

export function Title({ children }: { children: string }) {
  return (
    <Text variant="headlineMedium" accessibilityRole="header" style={styles.title}>
      {children}
    </Text>
  );
}

export function PrimaryButton({
  label,
  onPress,
  hint,
  disabled,
}: {
  label: string;
  onPress: () => void;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <Button
      mode="contained"
      onPress={onPress}
      disabled={disabled}
      style={styles.button}
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityRole="button"
    >
      {label}
    </Button>
  );
}

export function QuietButton({ label, onPress, hint }: { label: string; onPress: () => void; hint?: string }) {
  return (
    <Button
      mode="outlined"
      onPress={onPress}
      style={styles.button}
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityRole="button"
    >
      {label}
    </Button>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  secure,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secure?: boolean;
  hint?: string;
}) {
  return (
    <TextInput
      mode="outlined"
      label={label}
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={secure}
      autoCapitalize="none"
      allowFontScaling
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={styles.field}
    />
  );
}

export function Card({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 12 },
  title: { marginBottom: 4 },
  button: { borderRadius: 14 },
  field: { backgroundColor: 'transparent' },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 8 },
});
