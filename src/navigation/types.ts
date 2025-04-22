
//navigation/types.ts
export type RootStackParamList = {
    Lobby: undefined;
    CreateRoom: undefined;
    JoinRoom: undefined;
    WaitingRoom: { gameId: string };
    RoomLobby: { gameId: string };
    Game: { gameId: string };
    EndGame: { gameId: string };
    Collection: { gameId: string };
  };
  