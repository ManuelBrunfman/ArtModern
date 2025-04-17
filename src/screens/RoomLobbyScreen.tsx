import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, Alert, FlatList } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { dealInitialHands } from '../utils/gameSetup';


type RootStackParamList = {
  RoomLobby: { gameId: string };
  Game: { gameId: string };
};

type RoomLobbyRouteProp = RouteProp<RootStackParamList, 'RoomLobby'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function RoomLobbyScreen() {
  const { user } = useAuth();
  const route = useRoute<RoomLobbyRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { gameId } = route.params;

  const [game, setGame] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = firestore()
      .collection('games')
      .doc(gameId)
      .onSnapshot((doc) => {
        const data = doc.data();
        if (!data) return;

        setGame(data);

        if (data.status === 'in_progress') {
          navigation.navigate('Game', { gameId });
        }
      });

    return () => unsubscribe();
  }, [gameId]);


  const handleStartGame = async () => {
    try {
      await firestore().collection('games').doc(gameId).update({
        status: 'in_progress',
        currentTurn: game?.players?.[0]?.uid ?? null,
        round: 1,
      });
  
      await dealInitialHands(gameId); // ← repartir cartas después de iniciar
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
        renderItem={({ item }) => (
          <Text style={styles.player}>{item.name}</Text>
        )}
        style={{ marginBottom: 20 }}
      />

      {isHost && (
        <Button title="Iniciar juego" onPress={handleStartGame} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  roomCode: { fontSize: 18, marginBottom: 20, textAlign: 'center' },
  code: { fontWeight: 'bold', fontSize: 20, color: '#333' },
  subtitle: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  player: { fontSize: 16, paddingVertical: 4 },
});
