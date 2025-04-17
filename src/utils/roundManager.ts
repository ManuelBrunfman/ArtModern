// src/utils/roundManager.ts
import firestore from '@react-native-firebase/firestore';
import { dealInitialHands } from './gameSetup';

const MAX_ROUNDS = 4;

export async function checkAndAdvanceRound(gameId: string) {
  const gameRef = firestore().collection('games').doc(gameId);
  const doc = await gameRef.get();
  const game = doc.data();
  if (!game) return;

  const currentRound = game.round ?? 1;
  const artistCounts: { [artist: string]: number } = game.artistCounts ?? {};

  // 🔍 Verificar si se jugó la 5ta carta de algún artista
  const reachedLimit = Object.values(artistCounts).some((count) => count >= 5);
  if (!reachedLimit) return;

  // 🥇 Calcular popularidad de artistas esta ronda
  const sorted = Object.entries(artistCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const values = [30, 20, 10];
  const artistValues: { [artist: string]: number } = game.artistValues ?? {};

  sorted.forEach(([artist, _], index) => {
    artistValues[artist] = (artistValues[artist] || 0) + values[index];
  });

  const updates: any = {
    artistValues,
    artistCounts: {}, // reiniciar para próxima ronda
  };

  if (currentRound >= MAX_ROUNDS) {
    updates.status = 'finished';
  } else {
    updates.round = currentRound + 1;
    await dealInitialHands(gameId);
  }

  await gameRef.update(updates);
}
