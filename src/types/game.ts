// Tipos de subasta
export type AuctionType = "abierta" | "cerrada" | "una-vuelta" | "doble" | "fija";

// Artistas disponibles (pueden cambiar si usás otros)
export type Artist = "Karl" | "Yoko" | "Krypto" | "Christin" | "Lite Metal";

// Carta de juego
export interface Card {
  id: string; // UUID
  artist: Artist;
  auction: AuctionType;
  value?: number; // Se usa al final de ronda
  double?: boolean; // Para subasta doble
  playedBy?: string; // ID jugador que la jugó
}

// Jugador
export interface Player {
  id: string;
  uid: string; // 👈 Agregá esta línea

  name: string;
  money: number;
  hand: Card[];
  soldCards: Card[];
  isHost?: boolean;
}

// Pujas (para subastas cerradas, una vuelta, etc.)
export interface Bid {
  playerId: string;
  amount: number;
  revealed?: boolean; // true solo al resolver subasta
}

// Subasta activa
export interface Auction {
  type: AuctionType;
  card: Card;
  hostPlayerId: string;
  bids: Bid[];
  highestBid?: Bid;
  resolved: boolean;
  turnOrder?: string[]; // Para subasta a una vuelta
  currentTurnIndex?: number;
}

// Partida en Firestore
export interface Game {
  id: string;
  status: "waiting" | "in-progress" | "finished";
  players: Player[];
  round: number;
  artistCounts: Record<Artist, number>; // { "Karl": 3, "Yoko": 1, ... }
  deck: Card[];
  discardPile: Card[];
  auction?: Auction;
  turnPlayerId?: string;
  createdAt: number;
}
