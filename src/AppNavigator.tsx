import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './screens/LoginScreen';
import LobbyScreen from './screens/LobbyScreen';
import RoomLobbyScreen from './screens/RoomLobbyScreen';
import EndGameScreen from './screens/EndGameScreen';
import CreateRoomScreen from './screens/CreateRoomScreen'; // 👈 nueva pantalla
import JoinRoomScreen from './screens/JoinRoomScreen';
import WaitingRoomScreen from './screens/WaitingRoomScreen';
import { useAuth } from './context/AuthContext';
import { ActivityIndicator, View } from 'react-native';
import PlayerCollectionScreen from './screens/PlayerCollectionScreen';
import GameScreen from './screens/GameScreen';


const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
  {user ? (
    <>
      <Stack.Screen name="Lobby" component={LobbyScreen} />
      <Stack.Screen name="CreateRoom" component={CreateRoomScreen} />
      <Stack.Screen name="JoinRoom" component={JoinRoomScreen} />
      <Stack.Screen name="RoomLobby" component={RoomLobbyScreen} />
      <Stack.Screen name="WaitingRoom" component={WaitingRoomScreen} /> 
      <Stack.Screen name="Game" component={GameScreen} />
      <Stack.Screen name="Collection" component={PlayerCollectionScreen} />
      <Stack.Screen name="EndGame" component={EndGameScreen} />
    </>
  ) : (
    <Stack.Screen name="Login" component={LoginScreen} />
  )}
</Stack.Navigator>

  );
}
