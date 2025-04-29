import firestore from '@react-native-firebase/firestore';
import { checkAndAdvanceRound } from '../utils/roundManager';
import type { Game, Auction, Bid, AuctionType } from '../types/game';

const gameRef = (id: string) => firestore().collection('games').doc(id);

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

/* ───── placeBid ───── */
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
    if (!auction) throw new Error('No hay subasta');

    const me = game.players.find((p) => p.uid === uid);
    if (!me || me.money < amount) throw new Error('Saldo insuficiente');

    const kind = toES(auction.type);
    const bids: Bid[] = [...auction.bids];

    if (kind === 'abierta' || kind === 'doble') {
      const current = auction.highestBid?.amount ?? 0;
      if (amount <= current) throw new Error('Debe superar la puja actual');
      if (auction.highestBid?.playerId === uid)
        throw new Error('Ya sos el mejor postor');

      const newBid: Bid = { playerId: uid, amount };
      bids.push(newBid);
      const newAuction: Auction = {
        ...auction,
        bids,
        highestBid: newBid,
      };
      tx.update(gameRef(gameId), { auction: newAuction });
    } else if (kind === 'una-vuelta') {
      if (bids.some((b) => b.playerId === uid))
        throw new Error('Solo una oferta por jugador');
      bids.push({ playerId: uid, amount });
      tx.update(gameRef(gameId), { 'auction.bids': bids });
    } else if (kind === 'cerrada') {
      const idx = bids.findIndex((b) => b.playerId === uid);
      idx >= 0 ? (bids[idx] = { playerId: uid, amount }) : bids.push({ playerId: uid, amount });
      tx.update(gameRef(gameId), { 'auction.bids': bids });
    } else {
      throw new Error(`Subasta «${auction.type}» no soportada`);
    }
  });
}

/* ───── acceptFixedPrice ───── */
export async function acceptFixedPriceTransactional(
  gameId: string,
  uid: string,
) {
  await firestore().runTransaction(async (tx) => {
    const snap = await tx.get(gameRef(gameId));
    if (!snap.exists) throw new Error('Partida no encontrada');
    const game = snap.data() as Game;

    const auction = game.auction;
    if (!auction || toES(auction.type) !== 'fija')
      throw new Error('No es precio fijo');
    if (auction.highestBid) throw new Error('Ya vendida');

    const price = auction.fixedPrice ?? 0;
    const me = game.players.find((p) => p.uid === uid);
    if (!me || me.money < price) throw new Error('Saldo insuficiente');

    const newBid: Bid = { playerId: uid, amount: price };
    tx.update(gameRef(gameId), {
      'auction.highestBid': newBid,
      'auction.bids': [...auction.bids, newBid],
    });
  });
}

/* ───── finishAuction ───── */
export async function finishAuctionTransactional(gameId: string) {
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

    if (kind === 'abierta' || kind === 'doble' || kind === 'fija') {
      winnerId = auction.highestBid?.playerId ?? null;
      price = auction.highestBid?.amount ?? auction.fixedPrice ?? 0;
    } else {
      const top = [...auction.bids].sort((a, b) => b.amount - a.amount)[0];
      if (top) {
        winnerId = top.playerId;
        price = top.amount;
      }
    }

    if (!winnerId) {
      tx.update(ref, { auction: firestore.FieldValue.delete() });
      return;
    }

    const players = game.players.map((p) => {
      if (p.uid === winnerId) return { ...p, money: p.money - price };
      if (p.uid === auction.hostPlayerId) return { ...p, money: p.money + price };
      return p;
    });

    const sellerIdx = game.players.findIndex((p) => p.uid === auction.hostPlayerId);
    const nextIdx = (sellerIdx + 1) % game.players.length;

    const counts = { ...game.artistCounts };
    counts[auction.card.artist] = (counts[auction.card.artist] ?? 0) + 1;

    tx.update(ref, {
      players,
      artistCounts: counts,
      turnPlayerId: game.players[nextIdx].uid,
      auction: firestore.FieldValue.delete(),
    });
  });

  await checkAndAdvanceRound(gameId);
}

/* ───── cancelAuction ───── */
export async function cancelAuctionTransactional(gameId: string, uid: string) {
  await firestore().runTransaction(async (tx) => {
    const ref = gameRef(gameId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Partida no encontrada');

    const game = snap.data() as Game;
    const auction = game.auction;
    if (!auction || auction.hostPlayerId !== uid) return;

    const sellerIdx = game.players.findIndex((p) => p.uid === uid);
    const nextIdx = (sellerIdx + 1) % game.players.length;

    tx.update(ref, {
      turnPlayerId: game.players[nextIdx].uid,
      auction: firestore.FieldValue.delete(),
    });
  });
}
