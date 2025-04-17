import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../context/AuthContext';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  Game: { gameId: string };
  Lobby: undefined;
  JoinRoom: undefined;
};

const JoinRoomScreen = () => {
  const [code, setCode] = useState('');
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleJoinRoom = async () => {
    if (!code) return;
    if (!user) {
      Alert.alert('No hay usuario autenticado');
      return;
    }

    try {
      const query = await firestore()
        .collection('games')
        .where('roomCode', '==', code)
        .limit(1)
        .get();

      if (query.empty) {
        Alert.alert('Sala no encontrada');
        return;
      }

      const gameDoc = query.docs[0];
      await firestore()
        .collection('games')
        .doc(gameDoc.id)
        .update({
          players: firestore.FieldValue.arrayUnion({
            uid: user.uid,
            name: user.displayName,
            photoURL: user.photoURL,
            money: 0,
            isHost: false,
          }),
        });

      navigation.navigate('Game', { gameId: gameDoc.id });

    } catch (err) {
      console.error(err);
      Alert.alert('Error al unirse a la sala');
    }
  };

  return (
    <View style={{ padding: 20, flex: 1, justifyContent: 'center' }}>
      <Text style={{ fontSize: 20, marginBottom: 20 }}>Unirse a una sala</Text>
      <TextInput
        placeholder="Código de sala"
        value={code}
        onChangeText={setCode}
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          padding: 10,
          marginBottom: 20,
          borderRadius: 6,
        }}
      />
      <Button title="Unirse" onPress={handleJoinRoom} />
    </View>
  );
};

export default JoinRoomScreen;
