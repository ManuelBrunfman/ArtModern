// src/services/auctionService.ts

import firestore from '@react-native-firebase/firestore';
import { checkAndAdvanceRound } from '../utils/roundManager';
import type { Game, Auction, Bid, Player } from '../types/game';

const gameRef = (id: string) => firestore().collection('games').doc(id);

/**
 * 1️⃣ Registrar una puja en subasta abierta
 */
export async function placeBidTransactional(
  gameId: string,
  uid: string,
  amount: number
): Promise<void> {
  await firestore().runTransaction(async (tx) => {
    const snap = await tx.get(gameRef(gameId));
    if (!snap.exists) throw new Error('Partida no encontrada');
    const game = snap.data() as Game;
    const auction = game.auction;
    if (!auction) throw new Error('No hay subasta activa');
    if (auction.type !== 'abierta')
      throw new Error('Tipo de subasta no soportado');

    const player = game.players.find((p) => p.uid === uid);
    if (!player) throw new Error('Jugador inválido');
    if (player.money < amount) throw new Error('Saldo insuficiente');

    const highest = auction.highestBid?.amount ?? 0;
    if (amount <= highest) throw new Error('Debe superar la oferta actual');
    if (auction.highestBid?.playerId === uid)
      throw new Error('Ya sos el mejor postor');

    const newBid: Bid = { playerId: uid, amount };
    const newBids = [...auction.bids, newBid];
    const newAuction: Auction = {
      ...auction,
      bids: newBids,
      highestBid: newBid,
    };

    tx.update(gameRef(gameId), { auction: newAuction });
  });
}

/**
 * 2️⃣ Finalizar subasta abierta
 */
export async function finishAuctionTransactional(
  gameId: string
): Promise<void> {
  await firestore().runTransaction(async (tx) => {
    const ref = gameRef(gameId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Partida no encontrada');
    const game = snap.data() as Game;
    const auction = game.auction;
    if (!auction || auction.type !== 'abierta') return;

    // Determinar ganador y precio
    const winnerId = auction.highestBid?.playerId ?? null;
    const price = auction.highestBid?.amount ?? 0;

    if (!winnerId) {
      tx.update(ref, { auction: firestore.FieldValue.delete() });
      return;
    }

    // Ajustar dinero de ganador y vendedor
    const updatedPlayers = game.players.map((p) => {
      if (p.uid === winnerId) {
        return { ...p, money: p.money - price, collection: [...p.collection, auction.card] };
      }
      if (p.uid === auction.hostPlayerId) {
        return { ...p, money: p.money + price };
      }
      return p;
    });

    // Calcular siguiente turno
    const sellerIdx = game.players.findIndex((p) => p.uid === auction.hostPlayerId);
    const nextIdx = (sellerIdx + 1) % game.players.length;
    const nextUid = game.players[nextIdx].uid;

    // Contar artista para valoraciones
    const counts = { ...game.artistCounts };
    const art = auction.card.artist;
    counts[art] = (counts[art] ?? 0) + 1;

    tx.update(ref, {
      players: updatedPlayers,
      artistCounts: counts,
      turnPlayerId: nextUid,
      auction: firestore.FieldValue.delete(),
    });
  });

  await checkAndAdvanceRound(gameId);
}

/**
 * 3️⃣ Cancelar subasta (sólo vendedor)
 */
export async function cancelAuctionTransactional(
  gameId: string,
  uid: string
): Promise<void> {
  await firestore().runTransaction(async (tx) => {
    const ref = gameRef(gameId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Partida no encontrada');
    const game = snap.data() as Game;
    const auction = game.auction;
    if (!auction || auction.type !== 'abierta') return;
    if (auction.hostPlayerId !== uid)
      throw new Error('Sólo el vendedor puede cancelar');

    const sellerIdx = game.players.findIndex((p) => p.uid === uid);
    const nextIdx = (sellerIdx + 1) % game.players.length;
    tx.update(ref, {
      turnPlayerId: game.players[nextIdx].uid,
      auction: firestore.FieldValue.delete(),
    });
  });
}
