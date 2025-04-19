// -----------------------------------------------------------------------------
// src/utils/gameSetup.ts
// Lógica de mazo + reparto de cartas iniciales
// -----------------------------------------------------------------------------
import firestore from '@react-native-firebase/firestore';

/* -------------------------------------------------------------------------- */
/* 1. Mazo de Modern Art                                                     */
/* -------------------------------------------------------------------------- */
const ARTISTS = ['Krypto', 'Yoko', 'Karl', 'Christin P.', 'Lite Metal'];

/** Devuelve un mazo de 60 cartas (5 artistas × 12) */
export const generateDeck = () => {
  const deck = [];
  let id = 1;
  for (const artist of ARTISTS) {
    for (let i = 0; i < 12; i++) {
      deck.push({ id: id++, artist });      // { id: 17, artist: 'Yoko' }
    }
  }
  return deck;
};

/** Mezcla el mazo (Fisher‑Yates) */
export const shuffle = <T,>(array: T[]): T[] => {
  const clone = [...array];
  for (let i = clone.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
};

/* -------------------------------------------------------------------------- */
/* 2. Reparto de 10 cartas a cada jugador                                     */
/* -------------------------------------------------------------------------- */
const CARDS_PER_PLAYER = 10;

export async function dealInitialHands(gameId: string) {
  console.log('🃏 dealInitialHands →', gameId);

  try {
    /* 1️⃣ Traer la partida */
    const gameRef = firestore().collection('games').doc(gameId);
    const snap    = await gameRef.get();
    const game    = snap.data();

    if (!game) {
      console.warn('❌ gameData vacío');
      return;
    }

    const players: any[] = game.players ?? [];
    const deck           = shuffle(generateDeck());

    /* 2️⃣ Comprobación de tamaño */
    if (players.length * CARDS_PER_PLAYER > deck.length) {
      console.warn(
        `⚠️ No hay suficientes cartas: ${players.length} jugadores × ${CARDS_PER_PLAYER
        } = ${players.length * CARDS_PER_PLAYER} > ${deck.length}`
      );
      return;
    }

    /* 3️⃣ Asignar mano */
    const playersWithHands = players.map((p, i) => {
      const start = i * CARDS_PER_PLAYER;
      const end   = start + CARDS_PER_PLAYER;
      const hand  = deck.slice(start, end);
      console.log(`🎴 ${p.name} recibe ${hand.length} cartas`);
      return { ...p, hand };
    });

    /* 4️⃣ Guardar */
    await gameRef.update({ players: playersWithHands });
    console.log('✅ Manos guardadas en Firestore');
  } catch (err) {
    console.error('❌ dealInitialHands error', err);
    throw err; // propagamos para que la pantalla muestre el Alert
  }
}
