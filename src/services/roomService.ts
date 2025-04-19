// -----------------------------------------------------------------------------
// src/services/roomService.ts
// Crear sala y unirse a sala
// -----------------------------------------------------------------------------
import firestore from '@react-native-firebase/firestore';

/* --------------------------------------------------------------------------
 * 1. Utilidad para generar código público
 * ------------------------------------------------------------------------- */
const generateRoomCode = (): string => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  return (
    letters[Math.floor(Math.random() * 26)] +
    letters[Math.floor(Math.random() * 26)] +
    letters[Math.floor(Math.random() * 26)] +
    letters[Math.floor(Math.random() * 26)] +
    numbers[Math.floor(Math.random() * 10)] +
    numbers[Math.floor(Math.random() * 10)]
  );
};

/* --------------------------------------------------------------------------
 * 2. Crear sala
 * ------------------------------------------------------------------------- */
export const createRoom = async (
  hostId: string,
  displayName?: string,
  photoURL?: string
): Promise<{ gameId: string; roomCode: string }> => {
  const roomCode = generateRoomCode();

  const newGame = {
    hostId,
    createdAt: Date.now(),
    roomCode,
    round: 1,
    status: 'waiting',
    currentTurn: null,
    players: [
      {
        uid: hostId,
        name: typeof displayName === 'string' ? displayName : 'Anónimo',
        photoURL: typeof photoURL === 'string' ? photoURL : undefined,
        money: 100,
        hand: [],
        isHost: true,
      },
    ],
  };

  const gameRef = await firestore().collection('games').add(newGame);
  return { gameId: gameRef.id, roomCode };
};

/* --------------------------------------------------------------------------
 * 3. Unirse a sala existente
 * ------------------------------------------------------------------------- */
export const joinRoom = async (
  code: string,
  uid: string,
  displayName?: string,
  photoURL?: string
): Promise<string> => {
  // buscar sala por código
  const query = await firestore()
    .collection('games')
    .where('roomCode', '==', code.toUpperCase())
    .limit(1)
    .get();

  if (query.empty) {
    throw new Error('Sala no encontrada');
  }

  const gameDoc = query.docs[0];
  const gameId = gameDoc.id;

  const player = {
    uid,
    name: typeof displayName === 'string' ? displayName : 'Anónimo',
    photoURL: typeof photoURL === 'string' ? photoURL : undefined,
    money: 100,
    hand: [],
    isHost: false,
  };

  // agregar jugador
  await firestore()
    .collection('games')
    .doc(gameId)
    .update({
      players: firestore.FieldValue.arrayUnion(player),
    });

  return gameId;
};
