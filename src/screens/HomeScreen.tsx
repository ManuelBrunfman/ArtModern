import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function HomeScreen() {
  const { logout, user } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>¡Hola! Tu UID es:</Text>
      <Text style={styles.uid}>{user?.uid}</Text>
      <Button title="Cerrar sesión" onPress={logout} />
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
  text: {
    fontSize: 16,
  },
  uid: {
    fontSize: 12,
    marginVertical: 8,
    color: 'gray',
  },
});
