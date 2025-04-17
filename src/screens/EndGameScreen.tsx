// src/screens/EndGameScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Button, Alert } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { dealInitialHands } from '../utils/gameSetup';

type RootStackParamList = {
  EndGame: { gameId: string };
  Lobby: undefined;
  Game: { gameId: string };
};

type EndGameRouteProp = RouteProp<RootStackParamList, 'EndGame'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function EndGameScreen() {
  const route = useRoute<EndGameRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { gameId } = route.params;

  const [players, setPlayers] = useState<any[]>([]);
  const [artistValues, setArtistValues] = useState<{ [artist: string]: number }>({});

  useEffect(() => {
    const unsubscribe = firestore()
      .collection('games')
      .doc(gameId)
      .onSnapshot((doc) => {
        const data = doc.data();
        if (!data) return;
        setPlayers(data.players || []);
        setArtistValues(data.artistValues || {});
      });

    return () => unsubscribe();
  }, [gameId]);

  const sortedPlayers = [...players].sort((a, b) => b.money - a.money);
  const winner = sortedPlayers[0];

  const handleRestartGame = async () => {
    try {
      const resetPlayers = players.map((p) => ({
        ...p,
        money: 100,
        hand: [],
      }));

      const gameRef = firestore().collection('games').doc(gameId);

      await gameRef.update({
        players: resetPlayers,
        round: 1,
        status: 'in_progress',
        artistValues: {},
        artistCounts: {},
        currentAuction: firestore.FieldValue.delete(),
        currentTurn: resetPlayers[0]?.uid ?? null,
      });

      await dealInitialHands(gameId);

      navigation.navigate('Game', { gameId });
    } catch (err) {
      console.error(err);
      Alert.alert('Error al reiniciar la partida');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎉 Fin del Juego 🎉</Text>

      <Text style={styles.winner}>🏆 Ganador: {winner?.name} con ${winner?.money}</Text>

      <Text style={styles.subtitle}>Ranking de jugadores:</Text>
      <FlatList
        data={sortedPlayers}
        keyExtractor={(item) => item.uid}
        renderItem={({ item }) => (
          <Text style={styles.player}>{item.name} - ${item.money}</Text>
        )}
        style={{ marginBottom: 20 }}
      />

      <Text style={styles.subtitle}>Valor acumulado de artistas:</Text>
      {Object.entries(artistValues).map(([artist, value]) => (
        <Text key={artist} style={styles.artist}>
          🎨 {artist}: ${value}
        </Text>
      ))}

      <View style={{ marginTop: 30 }}>
        <Button title="Volver al Lobby" onPress={() => navigation.navigate('Lobby')} />
        <View style={{ height: 12 }} />
        <Button title="Reiniciar partida" onPress={handleRestartGame} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  winner: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  subtitle: { fontSize: 18, fontWeight: '600', marginTop: 10, marginBottom: 8 },
  player: { fontSize: 16, marginVertical: 4 },
  artist: { fontSize: 16, marginVertical: 2 },
});
