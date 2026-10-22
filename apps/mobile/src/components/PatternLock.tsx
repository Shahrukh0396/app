import { useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { dotAt, extendPattern, patternDots } from '../security/pattern';

const SIZE = 240;
const RADIUS = 28;

export function PatternLock({ onComplete }: { onComplete: (pattern: number[]) => void }) {
  const dots = useRef(patternDots(SIZE)).current;
  const sequenceRef = useRef<number[]>([]);
  const [sequence, setSequence] = useState<number[]>([]);
  const remember = (x: number, y: number) => {
    const next = extendPattern(sequenceRef.current, dotAt(dots, x, y, RADIUS));
    sequenceRef.current = next;
    setSequence(next);
  };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        sequenceRef.current = [];
        remember(event.nativeEvent.locationX, event.nativeEvent.locationY);
      },
      onPanResponderMove: (event) => remember(event.nativeEvent.locationX, event.nativeEvent.locationY),
      onPanResponderRelease: () => onComplete(sequenceRef.current),
    }),
  ).current;
  return (
    <View
      style={styles.pad}
      accessibilityLabel={sequence.length ? `Pattern ${sequence.join(' ')}` : 'Pattern lock'}
      accessibilityHint="Pan across the dots"
      {...pan.panHandlers}
    >
      {dots.map((dot) => (
        <View
          key={dot.index}
          style={[
            styles.dot,
            { left: dot.x - 16, top: dot.y - 16 },
            sequence.includes(dot.index) ? styles.dotActive : null,
          ]}
        />
      ))}
      <Text style={styles.caption}>{sequence.length ? sequence.join('-') : 'Draw a pattern'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { width: SIZE, height: SIZE, alignSelf: 'center', backgroundColor: '#E7F2F1', borderRadius: 16 },
  dot: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#9BB8B6',
  },
  dotActive: { backgroundColor: '#0F6E6B' },
  caption: { position: 'absolute', bottom: 8, alignSelf: 'center' },
});
