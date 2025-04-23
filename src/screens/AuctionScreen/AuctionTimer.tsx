import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';

interface Props {
  timeLeft: number;
  duration: number;
  onTimeout: () => void;
}

const AuctionTimer: React.FC<Props> = ({ timeLeft, duration, onTimeout }) => {
  const anim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    anim.setValue(1);
    Animated.timing(anim, {
      toValue: 0,
      duration: duration * 1000,
      useNativeDriver: false
    }).start(({ finished }) => finished && onTimeout());
  }, [timeLeft]);

  const width = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%']
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.bar, { width }]} />
      <Text style={styles.text}>{Math.ceil(timeLeft)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  bar: { height: 5, backgroundColor: '#4CAF50', flex: 1, marginRight: 8 },
  text: { width: 35, textAlign: 'right' }
});

export default AuctionTimer;