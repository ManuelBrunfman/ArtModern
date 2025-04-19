// src/screens/PlayerCollectionScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useRoute } from '@react-navigation/native';

export default function PlayerCollectionScreen() {
  const route = useRoute();
  const { gameId } = route.params as { gameId: string };
  const [players, setPlayers] = useState<any[]>([]);

  useEffect(() => {
    const unsub = firestore().collection('games').doc(gameId).onSnapshot((doc) => {
      const data = doc.data();
      if (!data) return;
      setPlayers(data.players || []);
    });
    return () => unsub();
  }, []);

  const renderCollection = (collection: any[]) => {
    const grouped: Record<string, string[]> = {};
    collection.forEach((card) => {
      if (!grouped[card.artist]) grouped[card.artist] = [];
      grouped[card.artist].push(card.title);
    });

    return Object.entries(grouped).map(([artist, titles]) => (
      <View key={artist} style={styles.artistBlock}>
        <Text style={styles.artist}>{artist} ({titles.length})</Text>
        {titles.map((title, index) => (
          <Text key={index} style={styles.cardTitle}>- {title}</Text>
        ))}
      </View>
    ));
  };

  return (
    <FlatList
      data={players}
      keyExtractor={(item) => item.uid}
      contentContainerStyle={styles.container}
      renderItem={({ item }) => (
        <View style={styles.playerBlock}>
          <Text style={styles.playerName}>{item.name}</Text>
          {item.collection?.length > 0
            ? renderCollection(item.collection)
            : <Text>No ganó obras aún.</Text>}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  playerBlock: {
    marginBottom: 24,
    borderBottomWidth: 1,
    borderColor: '#ccc',
    paddingBottom: 12,
  },
  playerName: { fontSize: 18, fontWeight: 'bold', marginBottom: 6 },
  artistBlock: { marginLeft: 10, marginBottom: 8 },
  artist: { fontSize: 16, fontWeight: '600' },
  cardTitle: { fontSize: 14, marginLeft: 8 },
});
