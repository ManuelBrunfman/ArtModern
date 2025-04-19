import firestore from '@react-native-firebase/firestore';

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

export const createRoom = async (
  hostId: string,
  displayName: string = 'Anónimo',
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
        name: displayName,
        photoURL,
        money: 100,
        hand: [],
        isHost: true,
      },
    ],
  };

  const gameRef = await firestore().collection('games').add(newGame);
  return { gameId: gameRef.id, roomCode };
};
