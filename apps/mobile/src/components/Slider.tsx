import { useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

export function ContinuousSlider({
  label,
  value,
  minimum,
  maximum,
  onChange,
}: {
  label: string;
  value: number;
  minimum: number;
  maximum: number;
  onChange: (value: number) => void;
}) {
  const [width, setWidth] = useState(1);
  const widthRef = useRef(1);
  const update = (x: number) => {
    const span = Math.max(1, widthRef.current);
    const ratio = Math.min(1, Math.max(0, x / span));
    onChange(minimum + ratio * (maximum - minimum));
  };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => update(event.nativeEvent.locationX),
      onPanResponderMove: (event) => update(event.nativeEvent.locationX),
    }),
  ).current;
  const ratio = Math.min(1, Math.max(0, (value - minimum) / (maximum - minimum || 1)));
  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: minimum, max: maximum, now: Math.round(value) }}
    >
      <Text>
        {label} {Math.round(value)}
      </Text>
      <View
        style={styles.track}
        onLayout={(event) => {
          const next = event.nativeEvent.layout.width;
          widthRef.current = next;
          setWidth(next);
        }}
        {...pan.panHandlers}
      >
        <View style={[styles.fill, { width: ratio * width }]} />
        <View style={[styles.thumb, { left: Math.max(0, ratio * width - 10) }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 36, justifyContent: 'center' },
  fill: { height: 4, backgroundColor: '#0F6E6B', borderRadius: 2 },
  thumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0F6E6B',
  },
});
