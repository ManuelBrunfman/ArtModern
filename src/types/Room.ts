export type Room = {
    id: string;
    hostId: string;
    createdAt: number;
    players: string[];
    status: 'waiting' | 'started' | 'finished';
  };
  