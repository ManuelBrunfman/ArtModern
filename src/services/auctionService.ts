import firestore from '@react-native-firebase/firestore';
import { checkAndAdvanceRound } from '../utils/roundManager';
import type { Game, Auction, Bid, AuctionType } from '../types/game';

// Reference al documento de la partida
const gameRef = (id: string) => firestore().collection('games').doc(id);

// Mapea tipos en inglés a los definidos en español en tu esquema
const toES = (x: string): AuctionType => {
  const map: Record<string, AuctionType> = {
    open: 'abierta',
    abierta: 'abierta',
    sealed: 'cerrada',
    cerrada: 'cerrada',
    once: 'una-vuelta',
    'una-vuelta': 'una-vuelta',
    double: 'doble',
    doble: 'doble',
    fixed: 'fija',
    fija: 'fija',
  };
  return (map[x] ?? x) as AuctionType;
};

/**
 * Registra una puja en subasta "open" ("abierta" / "doble").
 */
export async function placeBidTransactional(
  gameId: string,
  uid: string,
  amount: number,
) {
  await firestore().runTransaction(async (tx) => {
    const snap = await tx.get(gameRef(gameId));
    if (!snap.exists) throw new Error('Partida no encontrada');
    const game = snap.data() as Game;
    const auction = game.auction;
    if (!auction) throw new Error('No hay subasta activa');
    
    // Busca al jugador
    const me = game.players.find((p) => p.uid === uid);
    if (!me) throw new Error('Jugador inválido');
    if (me.money < amount) throw new Error('Saldo insuficiente');

    const kind = toES(auction.type);
    // Copia el array para no mutar directamente snapshot
    const bids: Bid[] = [...auction.bids];

    // Solo manejamos "abierta" y "doble"
    if (kind === 'abierta' || kind === 'doble') {
      const currentMax = auction.highestBid?.amount ?? 0;
      if (amount <= currentMax)
        throw new Error('Debe superar la puja actual');
      if (auction.highestBid?.playerId === uid)
        throw new Error('Ya sos el mejor postor');

      const newBid: Bid = { playerId: uid, amount };
      bids.push(newBid);

      // Actualiza bids y highestBid
      const newAuction: Auction = {
        ...auction,
        bids,
        highestBid: newBid,
      };
      await tx.update(gameRef(gameId), { auction: newAuction });
    } else {
      throw new Error(`Subasta "${auction.type}" no soportada`);
    }
  });
}

/**
 * Finaliza la subasta: determina ganador, transfiere dinero y rota el turno.
 */
export async function finishAuctionTransactional(
  gameId: string,
): Promise<void> {
  await firestore().runTransaction(async (tx) => {
    const ref = gameRef(gameId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Partida no encontrada');
    const game = snap.data() as Game;
    const auction = game.auction;
    if (!auction) return;

    const kind = toES(auction.type);
    let winnerId: string | null = null;
    let price = 0;

    if (kind === 'abierta' || kind === 'doble') {
      winnerId = auction.highestBid?.playerId ?? null;
      price = auction.highestBid?.amount ?? 0;
    }

    // Si nadie ofertó, limpia subasta
    if (!winnerId) {
      await tx.update(ref, { auction: firestore.FieldValue.delete() });
      return;
    }

    // Ajusta saldos
    const updatedPlayers = game.players.map((p) => {
      if (p.uid === winnerId) return { ...p, money: p.money - price };
      if (p.uid === auction.hostPlayerId)
        return { ...p, money: p.money + price };
      return p;
    });

    // Calcula siguiente vendedor
    const sellerIdx = game.players.findIndex(
      (p) => p.uid === auction.hostPlayerId,
    );
    const nextIdx = (sellerIdx + 1) % game.players.length;

    // Actualiza artista
    const counts = { ...game.artistCounts };
    const art = auction.card.artist;
    counts[art] = (counts[art] ?? 0) + 1;

    await tx.update(ref, {
      players: updatedPlayers,
      artistCounts: counts,
      turnPlayerId: game.players[nextIdx].uid,
      auction: firestore.FieldValue.delete(),
    });
  });

  // Avanza de ronda si corresponde fuera de la transacción
  await checkAndAdvanceRound(gameId);
}

/**
 * Permite al vendedor cancelar la subasta y pasar turno.
 */
export async function cancelAuctionTransactional(
  gameId: string,
  uid: string,
) {
  await firestore().runTransaction(async (tx) => {
    const ref = gameRef(gameId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Partida no encontrada');
    const game = snap.data() as Game;
    const auction = game.auction;
    if (!auction || auction.hostPlayerId !== uid)
      throw new Error('Solo el vendedor puede cancelar');

    const sellerIdx = game.players.findIndex((p) => p.uid === uid);
    const nextIdx = (sellerIdx + 1) % game.players.length;

    await tx.update(ref, {
      turnPlayerId: game.players[nextIdx].uid,
      auction: firestore.FieldValue.delete(),
    });
  });
}