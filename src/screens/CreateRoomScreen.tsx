// src/screens/CreateRoomScreen.tsx
import React from 'react';
import { View, Text, Button, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { createRoom } from '../services/roomService';
import { sanitizeNullableString } from '../utils/sanitize';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

export default function CreateRoomScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'CreateRoom'>>();
  const { user } = useAuth();

  const handleCreateRoom = async () => {
    if (!user) return;
  
    try {
      const { gameId, roomCode } = await createRoom(
        user.uid,
        sanitizeNullableString(user.displayName),
        sanitizeNullableString(user.photoURL)
      );
  
      Alert.alert('Sala creada', `Código: ${roomCode}`);
      navigation.navigate('RoomLobby', { gameId }); // ✅ ahora sí pasa un string
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      Alert.alert('Error al crear sala', message);
    }
  };
  

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Crear una nueva sala 🧩</Text>
      <Button title="Crear sala" onPress={handleCreateRoom} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
  },
});
