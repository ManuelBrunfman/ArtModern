import React from 'react';
import { View, Text, StyleSheet, Image, Button } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';

export default function LobbyScreen() {
  const { user, logout } = useAuth();
  const navigation = useNavigation<any>();

  return (
    <View style={styles.container}>
      {user?.photoURL && (
        <Image source={{ uri: user.photoURL }} style={styles.avatar} />
      )}
      <Text style={styles.name}>Hola, {user?.displayName || 'Jugador'} 👋</Text>

      <View style={styles.buttons}>
        <Button title="🎲 Crear sala" onPress={() => navigation.navigate('CreateRoom')} />
        <View style={{ height: 16 }} />
        <Button title="🔑 Unirse a sala" onPress={() => navigation.navigate('JoinRoom')} />
        <View style={{ height: 32 }} />
        <Button title="🚪 Cerrar sesión" onPress={logout} color="#B00020" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 16,
  },
  name: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 24,
  },
  buttons: {
    width: '100%',
  },
});
