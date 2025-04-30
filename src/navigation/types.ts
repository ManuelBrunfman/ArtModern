export type RootStackParamList = {
  Login: undefined;
  Lobby: undefined;
  CreateRoom: undefined;
  JoinRoom: undefined;
  RoomLobby: undefined;
  Game: undefined;
  Auction: { gameId: string; userId: string };
  Collection: undefined;
  EndGame: undefined;
};
