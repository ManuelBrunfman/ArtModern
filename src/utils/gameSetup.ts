// src/utils/gameSetup.ts
import firestore from '@react-native-firebase/firestore';

type Card = {
  id: string;
  title: string;
  artist: string;
  auctionType: 'open' | 'sealed' | 'once' | 'double';
};

const allAuctionTypes = ['open', 'sealed', 'once', 'double'] as const;
const artists = ['Van Gogh', 'Picasso', 'Kahlo', 'Dalí', 'Matisse'];

function generateDeck(): Card[] {
  const deck: Card[] = [];
  let idCounter = 1;

  for (let i = 0; i < 50; i++) {
    const artist = artists[i % artists.length];
    const auctionType = allAuctionTypes[i % allAuctionTypes.length];
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
  const doc = await gameRef.get();
  const gameData = doc.data();
  if (!gameData) return;

  const deck = generateDeck();
  const shuffled = deck.sort(() => Math.random() - 0.5);
  const players = gameData.players;
  const cardsPerPlayer = 10;

  const playersWithHands = players.map((p: any, i: number) => {
    const start = i * cardsPerPlayer;
    const end = start + cardsPerPlayer;
    const hand = shuffled.slice(start, end);
    return { ...p, hand };
  });

  await gameRef.update({
    players: playersWithHands,
  });
}
