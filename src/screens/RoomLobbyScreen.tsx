// -----------------------------------------------------------------------------
// src/screens/RoomLobbyScreen.tsx — reparte primero, luego cambia a in_progress
// -----------------------------------------------------------------------------
import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, Alert, FlatList } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { dealInitialHands } from '../utils/gameSetup';

type NavigationProp   = NativeStackNavigationProp<RootStackParamList, 'RoomLobby'>;
type RoomLobbyRoute   = RouteProp<RootStackParamList, 'RoomLobby'>;

export default function RoomLobbyScreen() {
  const { user }       = useAuth();
  const navigation     = useNavigation<NavigationProp>();
  const { params }     = useRoute<RoomLobbyRoute>();
  const { gameId }     = params;

  const [game, setGame] = useState<any>(null);

  /* Suscripción en tiempo real */
  useEffect(() => {
    const unsub = firestore()
      .collection('games')
      .doc(gameId)
      .onSnapshot((d) => {
        const data = d.data();
        if (!data) return;

        setGame(data);

        if (data.status === 'in_progress') {
          navigation.navigate('Game', { gameId });
        }
      });

    return () => unsub();
  }, [gameId, navigation]);

  /* El host reparte y luego cambia el estado */
  const handleStartGame = async () => {
    try {
      Alert.alert('Repartiendo cartas…');
      await dealInitialHands(gameId);

      Alert.alert('¡Comienza la partida!');
      await firestore().collection('games').doc(gameId).update({
        status: 'in_progress',
        currentTurn: game?.players?.[0]?.uid ?? null,
        round: 1,
      });
    } catch (err) {
      console.error(err);
      Alert.alert('Error al iniciar el juego');
    }
  };

  if (!game) return null;

  const isHost = game.hostId === user?.uid;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sala de Espera 🎉</Text>

      <Text style={styles.roomCode}>
        Código de sala: <Text style={styles.code}>{game.roomCode}</Text>
      </Text>

      <Text style={styles.subtitle}>Jugadores conectados:</Text>
      <FlatList
        data={game.players}
        keyExtractor={(item) => item.uid}
        renderItem={({ item }) => <Text style={styles.player}>{item.name}</Text>}
        style={{ marginBottom: 20 }}
      />

      {isHost && <Button title="Iniciar juego" onPress={handleStartGame} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  title:     { fontSize: 24, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  roomCode:  { fontSize: 18, marginBottom: 20, textAlign: 'center' },
  code:      { fontWeight: 'bold', fontSize: 20, color: '#333' },
  subtitle:  { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  player:    { fontSize: 16, paddingVertical: 4 },
});
