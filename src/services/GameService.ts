import firestore from '@react-native-firebase/firestore';
import { Game, Player } from '../types/game';
import { v4 as uuidv4 } from 'uuid';

const gamesRef = firestore().collection('games');

export const createGame = async (host: Player): Promise<string> => {
  const newGame: Game = {
    id: uuidv4(),
    status: "waiting",
    players: [host],
    round: 1,
    artistCounts: { Karl: 0, Yoko: 0, Krypto: 0, Christin: 0, "Lite Metal": 0 },
    deck: [], // se llena al iniciar
    discardPile: [],
    createdAt: Date.now()
  };
  await gamesRef.doc(newGame.id).set(newGame);
  return newGame.id;
};

export const joinGame = async (gameId: string, player: Player) => {
  await gamesRef.doc(gameId).update({
    players: firestore.FieldValue.arrayUnion(player)
  });
};

export const subscribeToGame = (gameId: string, callback: (game: Game) => void) => {
  return gamesRef.doc(gameId).onSnapshot(snapshot => {
    const game = snapshot.data() as Game;
    if (game) callback(game);
  });
};
