// src/utils/gameSetup.ts
import firestore from '@react-native-firebase/firestore';

export type Card = {
  id: number;
  artist: string;
  auctionType: 'open' | 'sealed' | 'once' | 'double';
};

const ARTISTS = ['Krypto', 'Yoko', 'Karl', 'Christin P.', 'Lite Metal'];
const AUCTION_TYPES: Card['auctionType'][] = ['open', 'sealed', 'once', 'double'];

/** Devuelve un mazo de 60 cartas (5 artistas × 12) */
export const generateDeck = (): Card[] => {
  const deck: Card[] = [];
  let id = 1;
  for (const artist of ARTISTS) {
    for (let i = 0; i < 12; i++) {
      const auctionType = AUCTION_TYPES[(id - 1) % AUCTION_TYPES.length];
      deck.push({ id: id++, artist, auctionType });
    }
  }
  return deck;
};

export const shuffle = <T,>(array: T[]): T[] => {
  const clone = [...array];
  for (let i = clone.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
};

export async function dealInitialHands(gameId: string) {
  console.log('🃏 dealInitialHands →', gameId);

  const gameRef = firestore().collection('games').doc(gameId);
  const doc = await gameRef.get();
  const gameData = doc.data();

  if (!gameData) {
    console.warn('❌ gameData vacío');
    return;
  }

  const deck = shuffle(generateDeck());
  const players = gameData.players ?? [];
  const CARDS_PER_PLAYER = 10;

  if (players.length * CARDS_PER_PLAYER > deck.length) {
    console.warn(`⚠️ No hay suficientes cartas`);
    return;
  }

  const playersWithHands = players.map((p: any, i: number) => {
    const start = i * CARDS_PER_PLAYER;
    const end = start + CARDS_PER_PLAYER;
    const hand = deck.slice(start, end);
    return { ...p, hand };
  });

  await gameRef.update({ players: playersWithHands });
  console.log('✅ Manos guardadas en Firestore');
}
