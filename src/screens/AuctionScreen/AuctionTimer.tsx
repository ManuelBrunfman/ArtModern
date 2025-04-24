/**
 * Timer con barra de progreso de duración configurable.
 * • Llama opcionalmente a onTimeout() cuando llega a 0 s.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  timeLeft : number;          // segundos restantes
  duration : number;          // duración total
  onTimeout?: () => void;     // opcional
}

export default function AuctionTimer({ timeLeft, duration, onTimeout }: Props) {
  // dispara callback externo si existe
  useEffect(() => {
    if (timeLeft === 0) onTimeout?.();
  }, [timeLeft, onTimeout]);

  const progress = timeLeft / duration; // 1 → 0

  return (
    <View style={styles.container}>
      <Text style={styles.counter}>{timeLeft}s</Text>
      <View style={styles.bar}>
        <View style={[styles.fill, { flex: progress }]} />
        <View style={{ flex: 1 - progress }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ alignItems:'center', marginBottom:8 },
  counter  :{ fontWeight:'700', fontSize:16 },
  bar      :{ flexDirection:'row', height:6, width:'100%',
              backgroundColor:'#ddd', borderRadius:3, overflow:'hidden',
              marginTop:4 },
  fill     :{ backgroundColor:'#4CAF50' },
});
