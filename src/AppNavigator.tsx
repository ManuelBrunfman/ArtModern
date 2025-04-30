// src/AppNavigator.tsx
import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from './screens/LoginScreen';
import LobbyScreen from './screens/LobbyScreen';
import CreateRoomScreen from './screens/CreateRoomScreen';
import JoinRoomScreen from './screens/JoinRoomScreen';
import RoomLobbyScreen from './screens/RoomLobbyScreen';
import GameScreen from './screens/GameScreen';
import AuctionScreen from './screens/AuctionScreen/AuctionScreen';
import PlayerCollectionScreen from './screens/PlayerCollectionScreen';
import EndGameScreen from './screens/EndGameScreen';

import { useAuth } from './context/AuthContext';
import type { RootStackParamList } from './navigation/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

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
          <Stack.Screen name="Game" component={GameScreen} />
          <Stack.Screen name="Auction" component={AuctionScreen} />
          <Stack.Screen name="Collection" component={PlayerCollectionScreen} />
          <Stack.Screen name="EndGame" component={EndGameScreen} />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
