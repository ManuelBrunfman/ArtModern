import React, { createContext, useContext, useEffect, useState } from 'react';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from './AuthContext';
import { Game, Player } from '../types/game';

interface GameContextType {
  game: Game | null;
  player: Player | null;
  joinGame: (id: string) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [game, setGame] = useState<Game | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);

  // suscripción a Firestore
  useEffect(() => {
    if (!gameId) return;
    const unsub = firestore()
      .collection('games')
      .doc(gameId)
      .onSnapshot((doc) => {
        const data = doc.data() as Game;
        setGame(data);

        if (data && user) {
          const myPlayer = data.players.find((p) => p.uid === user.uid);
          if (myPlayer) setPlayer(myPlayer);
        }
      });

    return () => unsub();
  }, [gameId, user]);

  const joinGame = (id: string) => {
    setGameId(id);
  };

  return (
    <GameContext.Provider value={{ game, player, joinGame }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = (): GameContextType => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame debe usarse dentro de GameProvider');
  return ctx;
};
