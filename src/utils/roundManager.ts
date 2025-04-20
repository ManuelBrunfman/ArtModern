import firestore from '@react-native-firebase/firestore';
import { dealInitialHands } from './gameSetup';

const MAX_ROUNDS = 4;
const CARDS_PER_ROUND = 10;

/**
 * Calcula los valores Oro/Plata/Bronce según los 3 artistas más jugados.
 */
export const calculateArtistValues = (artistCounts: Record<string, number>) => {
  const sorted = Object.entries(artistCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const values: Record<string, number> = {};
  if (sorted[0]) values[sorted[0][0]] = 30;
  if (sorted[1]) values[sorted[1][0]] = 20;
  if (sorted[2]) values[sorted[2][0]] = 10;

  return values;
};

/**
 * Chequea si un artista llegó a 5 cartas. Si es así, avanza de ronda.
 */
export const checkAndAdvanceRound = async (gameId: string) => {
  const gameRef = firestore().collection('games').doc(gameId);
  const snapshot = await gameRef.get();
  const game = snapshot.data();

  if (!game) return;

  const artistCounts = game.artistCounts || {};
  const currentRound = game.round ?? 1;

  const artistaTerminoRonda = (Object.values(artistCounts) as number[]).some((count) => count >= 5);
  if (!artistaTerminoRonda) return;

  // Calcular valores por artista
  const artistValues = calculateArtistValues(artistCounts);

  // Pagar a jugadores por sus colecciones
  const updatedPlayers = (game.players || []).map((p: any) => {
    const collection = p.collection || [];
    let total = 0;

    for (const obra of collection) {
      const valor = artistValues[obra.artist] || 0;
      total += valor;
    }

    return { ...p, money: p.money + total };
  });

  if (currentRound >= MAX_ROUNDS) {
    // Fin del juego
    await gameRef.update({
      players: updatedPlayers,
      artistValues,
      status: 'finished',
    });
    return;
  }

  // Guardar valores de esta ronda como snapshot opcional (puede omitirse)
  await firestore()
    .collection('games')
    .doc(gameId)
    .collection('rounds')
    .doc(`round-${currentRound}`)
    .set({ artistValues, artistCounts, endedAt: Date.now() });

  // Avanzar de ronda
  await startNextRound(gameId, updatedPlayers);
};

/**
 * Inicia la siguiente ronda, mantiene cartas no jugadas y reparte nuevas.
 */
export const startNextRound = async (gameId: string, playersWithUpdatedMoney: any[]) => {
  const gameRef = firestore().collection('games').doc(gameId);
  const snapshot = await gameRef.get();
  const game = snapshot.data();

  if (!game || !Array.isArray(playersWithUpdatedMoney)) return;

  const nextRound = (game.round ?? 1) + 1;
  const deck: any[] = game.deck || [];

  const updatedPlayers = playersWithUpdatedMoney.map((p: any, index: number) => {
    const currentHand = p.hand || [];
    const newCards = deck.slice(index * CARDS_PER_ROUND, (index + 1) * CARDS_PER_ROUND);
    return {
      ...p,
      hand: [...currentHand, ...newCards],
    };
  });

  const used = playersWithUpdatedMoney.length * CARDS_PER_ROUND;
  const remainingDeck = deck.slice(used);

  await gameRef.update({
    round: nextRound,
    players: updatedPlayers,
    artistCounts: {}, // reset
    currentAuction: firestore.FieldValue.delete(),
    currentTurn: updatedPlayers[0]?.uid ?? null,
    deck: remainingDeck,
  });
};
