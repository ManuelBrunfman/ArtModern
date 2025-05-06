// src/utils/gameSetup.ts
import firestore from '@react-native-firebase/firestore';

type Card = {
  id: string;
  title: string;
  artist: string;
  auctionType: 'open';
};

const allAuctionTypes = ['open'] as const;  // solo open
const artists = ['Van Gogh', 'Picasso', 'Kahlo', 'Dalí', 'Matisse'];
const CARDS_PER_PLAYER = 10;

function generateDeck(): Card[] {
  const deck: Card[] = [];
  let idCounter = 1;

  for (let i = 0; i < 100; i++) {
    const artist = artists[i % artists.length];
    const auctionType = allAuctionTypes[0];  // siempre 'open'
    deck.push({
      id: `card-${idCounter++}`,
      title: `Obra ${i + 1}`,
      artist,
      auctionType,
    });
  }

  return deck;
}

export async function dealInitialHands(gameId: string) {
  const gameRef = firestore().collection('games').doc(gameId);
  const snapshot = await gameRef.get();
  const game = snapshot.data();
  if (!game) return;

  const deck = generateDeck();
  const shuffled = deck.sort(() => Math.random() - 0.5);
  const players = game.players;
  const updatedPlayers = players.map((p: any, i: number) => {
    const hand = shuffled.slice(i * CARDS_PER_PLAYER, (i + 1) * CARDS_PER_PLAYER);
    return {
      ...p,
      hand,
      collection: [],
      money: 100,
    };
  });

  const remainingDeck = shuffled.slice(CARDS_PER_PLAYER * players.length);

  await gameRef.update({
    players: updatedPlayers,
    deck: remainingDeck,
  });
}
