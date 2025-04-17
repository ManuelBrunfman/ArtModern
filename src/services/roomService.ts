import firestore from '@react-native-firebase/firestore';
import { Room } from '../types/Room';

export const createRoom = async (hostId: string): Promise<string> => {
  const newRoom: Omit<Room, 'id'> = {
    hostId,
    createdAt: Date.now(),
    players: [hostId],
    status: 'waiting',
  };

  const roomRef = await firestore().collection('rooms').add(newRoom);
  return roomRef.id;
};
