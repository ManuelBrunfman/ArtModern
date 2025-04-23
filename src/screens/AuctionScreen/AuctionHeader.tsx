import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  artwork: string;
  artist: string;
  typeName: string;
}

const AuctionHeader: React.FC<Props> = ({ artwork, artist, typeName }) => (
  <View style={styles.container}>
    <Text style={styles.artwork}>{artwork}</Text>
    <Text style={styles.artist}>{artist}</Text>
    <Text style={styles.type}>{typeName}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { alignItems: 'center', padding: 10 },
  artwork: { fontSize: 18, fontWeight: 'bold' },
  artist: { fontSize: 14 },
  type: { fontSize: 12, fontStyle: 'italic' }
});

export default AuctionHeader;