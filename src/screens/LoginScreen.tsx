import React from 'react';
import { View, Text, Button, StyleSheet, Image } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { loginWithGoogle } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bienvenido a Arte Moderno 🎨</Text>
      <Image
        source={require('../../assets/icon.png')}
        style={{ width: 100, height: 100, marginVertical: 24 }}
      />
      <Button title="Entrar con Google" onPress={loginWithGoogle} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
  },
});
