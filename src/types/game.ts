// src/types/game.ts

// Tipos de subasta
export type AuctionType = "abierta";

// Artistas disponibles (pueden cambiar si usás otros)
export type Artist = "Karl" | "Yoko" | "Krypto" | "Christin" | "Lite Metal";

// Carta de juego
export interface Card {
  id: string; // UUID
  artist: Artist;
  auction: AuctionType;
  value?: number;       // Se usa al final de ronda
  double?: boolean;     // Para subasta doble (queda siempre false en open)
  playedBy?: string;    // ID jugador que la jugó
}

// Jugador
export interface Player {
  id: string;
  uid: string;
  name: string;
  money: number;
  hand: Card[];
  soldCards: Card[];
  collection: Card[];
  isHost?: boolean;
}

// Pujas
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
  // Las propiedades de los otros modos ya no se usan
}

// Partida en Firestore
export interface Game {
  id: string;
  status: "waiting" | "in-progress" | "finished";
  players: Player[];
  round: number;
  artistCounts: Record<Artist, number>;
  deck: Card[];
  discardPile: Card[];
  auction?: Auction;
  turnPlayerId?: string;
  createdAt: number;
}
