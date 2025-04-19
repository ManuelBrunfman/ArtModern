import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, Alert, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import firestore from '@react-native-firebase/firestore';
import { joinRoom } from '../services/roomService';
import { sanitizeNullableString } from '../utils/sanitize';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'JoinRoom'>;

type GameRoom = {
  id: string;
  roomCode: string;
  players: any[];
};

const JoinRoomScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [rooms, setRooms] = useState<GameRoom[]>([]);

  useEffect(() => {
    const unsubscribe = firestore()
      .collection('games')
      .where('status', '==', 'waiting')
      .onSnapshot((querySnapshot) => {
        const availableRooms = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as GameRoom[];
        setRooms(availableRooms);
      });

    return () => unsubscribe();
  }, []);

  const handleJoin = async (roomCode: string) => {
    if (!user) return;
    try {
      const gameId = await joinRoom(
        roomCode,
        user.uid,
        sanitizeNullableString(user.displayName),
        sanitizeNullableString(user.photoURL)
      );
      navigation.navigate('WaitingRoom', { gameId });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al unirse a la sala';
      Alert.alert('Error', message);
    }
  };

  const handleJoinByCode = () => {
    if (!code.trim()) return;
    handleJoin(code.trim().toUpperCase());
  };

  const renderRoom = ({ item }: { item: GameRoom }) => {
    const alreadyJoined = item.players.some((p) => p.uid === user?.uid);

    return (
      <TouchableOpacity
        onPress={() => !alreadyJoined && handleJoin(item.roomCode)}
        style={[styles.roomItem, alreadyJoined && styles.disabledRoom]}
        disabled={alreadyJoined}
      >
        <Text style={styles.roomText}>🎨 Sala {item.roomCode}</Text>
        <Text style={styles.players}>👥 {item.players.length} jugadores</Text>
        {alreadyJoined && <Text style={styles.note}>Ya estás en esta sala</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Unirse a una sala</Text>

      <TextInput
        placeholder="Ingresar código de sala"
        value={code}
        onChangeText={setCode}
        style={styles.input}
        autoCapitalize="characters"
      />
      <Button title="Unirse con código" onPress={handleJoinByCode} />

      <Text style={styles.subtitle}>O elegir una sala activa:</Text>
      <FlatList
        data={rooms}
        keyExtractor={(item) => item.id}
        renderItem={renderRoom}
        ListEmptyComponent={<Text>No hay salas disponibles por ahora.</Text>}
      />
    </View>
  );
};

export default JoinRoomScreen;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { fontSize: 16, fontWeight: '600', marginTop: 20, marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
    borderRadius: 6,
  },
  roomItem: {
    padding: 14,
    marginBottom: 10,
    backgroundColor: '#f4f4f4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  disabledRoom: {
    backgroundColor: '#e0e0e0',
    opacity: 0.6,
  },
  roomText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  players: {
    fontSize: 14,
    marginTop: 4,
  },
  note: {
    fontSize: 12,
    color: '#555',
    marginTop: 4,
  },
});
