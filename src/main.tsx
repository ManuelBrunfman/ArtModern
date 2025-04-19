import React from 'react';
import { AuthProvider } from './context/AuthContext';
import { GameProvider } from './context/GameContext';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './AppNavigator';

export default function Main() {
  return (
    <AuthProvider>
      <GameProvider>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </GameProvider>
    </AuthProvider>
  );
}
