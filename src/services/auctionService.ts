/**
 * ───────────────────────────────────────────────────────────────────────────
 * auctionService.ts — alineado al esquema real del repositorio
 * ───────────────────────────────────────────────────────────────────────────
 */

import firestore from '@react-native-firebase/firestore';
import { checkAndAdvanceRound } from '../utils/roundManager';
import type {
  Game,
  Auction,
  Bid,
  Player,
  AuctionType as AuctionTypeES,
} from '../types/game';

/* ════════════════════════════════════════════════════════════════════════ */
/* 🔧 Helpers                                                               */
/* ════════════════════════════════════════════════════════════════════════ */

const ts = () => firestore.Timestamp.now();
const gameRef = (id: string) => firestore().collection('games').doc(id);

/** Mapeo castellano ↔️ inglés para convivir con pantallas en ambos idiomas */
const mapToES = (t: string): AuctionTypeES => {
  const m: Record<string, AuctionTypeES> = {
    abierta: 'abierta',
    open: 'abierta',
    cerrada: 'cerrada',
    sealed: 'cerrada',
    'una-vuelta': 'una-vuelta',
    once: 'una-vuelta',
    doble: 'doble',
    double: 'doble',
    fija: 'fija',
    fixed: 'fija',
  };
  return m[t] ?? (t as AuctionTypeES);
};

/* ════════════════════════════════════════════════════════════════════════ */
/* 1️⃣ Registrar una puja                                                   */
/* ════════════════════════════════════════════════════════════════════════ */
export async function placeBidTransactional(
  gameId: string,
  uid: string,
  amount: number,
): Promise<void> {
  await firestore().runTransaction(async (tx) => {
    /** 1. Traemos la partida sin genérico para evitar errores 2345 */
    const snap = await tx.get(gameRef(gameId));
    if (!snap.exists) throw new Error('Partida no encontrada');
    const game = snap.data() as Game;

    const auction = game.auction;
    if (!auction) throw new Error('No hay subasta activa');

    const player: Player | undefined = game.players.find((p) => p.uid === uid);
    if (!player) throw new Error('Jugador inválido');
    if (player.money < amount) throw new Error('Saldo insuficiente');

    /* 2. Normalizamos el tipo a castellano */
    const typeES = mapToES(auction.type as string);

    /* 3. Copiamos bids para no mutar directamente el snapshot */
    const bids: Bid[] = [...auction.bids];

    /* 4. Reglas por tipo de subasta */
    switch (typeES) {
      case 'abierta':
      case 'doble': {
        const currentMax = auction.highestBid?.amount ?? 0;
        if (amount <= currentMax) throw new Error('Debe superar la oferta actual');
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
        break;
      }

      case 'una-vuelta': {
        if (bids.some((b) => b.playerId === uid))
          throw new Error('Sólo una oferta por jugador');

        const newBid: Bid = { playerId: uid, amount };
        bids.push(newBid);

        tx.update(gameRef(gameId), { 'auction.bids': bids });
        break;
      }

      case 'cerrada': {
        /* En cerrada se permite sobrescribir antes del reveal */
        const idx = bids.findIndex((b) => b.playerId === uid);
        if (idx >= 0) bids[idx] = { playerId: uid, amount };
        else bids.push({ playerId: uid, amount });

        tx.update(gameRef(gameId), { 'auction.bids': bids });
        break;
      }

      default:
        throw new Error(`Tipo de subasta «${auction.type}» no soportado`);
    }
  });
}

/* ════════════════════════════════════════════════════════════════════════ */
/* 2️⃣ Aceptar precio fijo                                                  */
/* ════════════════════════════════════════════════════════════════════════ */
export async function acceptFixedPriceTransactional(
  gameId: string,
  uid: string,
): Promise<void> {
  await firestore().runTransaction(async (tx) => {
    const snap = await tx.get(gameRef(gameId));
    if (!snap.exists) throw new Error('Partida no encontrada');
    const game = snap.data() as Game;

    const auction = game.auction;
    if (!auction || mapToES(auction.type as string) !== 'fija')
      throw new Error('No es subasta de precio fijo');

    if (auction.highestBid) throw new Error('La obra ya tiene comprador');
    const price = auction.fixedPrice ?? 0;

    const buyer = game.players.find((p) => p.uid === uid);
    if (!buyer) throw new Error('Jugador inválido');
    if (buyer.money < price) throw new Error('Saldo insuficiente');

    const newBid: Bid = { playerId: uid, amount: price };

    tx.update(gameRef(gameId), {
      'auction.highestBid': newBid,
      'auction.bids': [...auction.bids, newBid],
    });
  });
}

/* ════════════════════════════════════════════════════════════════════════ */
/* 3️⃣ Finalizar subasta                                                    */
/* ════════════════════════════════════════════════════════════════════════ */
export async function finishAuctionTransactional(gameId: string): Promise<void> {
  await firestore().runTransaction(async (tx) => {
    const ref = gameRef(gameId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Partida no encontrada');
    const game = snap.data() as Game;

    const auction = game.auction;
    if (!auction) return;

    const typeES = mapToES(auction.type as string);

    /* ── Ganador y precio ─────────────────────────────────────────────── */
    let winnerId: string | null = null;
    let price = 0;

    if (typeES === 'abierta' || typeES === 'doble' || typeES === 'fija') {
      winnerId = auction.highestBid?.playerId ?? null;
      price = auction.highestBid?.amount ?? auction.fixedPrice ?? 0;
    } else {
      /* cerrada / una-vuelta */
      const sorted = [...auction.bids].sort((a, b) => b.amount - a.amount);
      if (sorted[0]) {
        winnerId = sorted[0].playerId;
        price = sorted[0].amount;
      }
    }

    /* ── Sin pujas: limpiar subasta ───────────────────────────────────── */
    if (!winnerId) {
      tx.update(ref, { auction: firestore.FieldValue.delete() });
      return;
    }

    /* ── Transferir dinero ────────────────────────────────────────────── */
    const updatedPlayers = game.players.map((pl) => {
      if (pl.uid === winnerId) return { ...pl, money: pl.money - price };
      if (pl.uid === auction.hostPlayerId)
        return { ...pl, money: pl.money + price };
      return pl;
    });

    /* ── Avanzar turno ────────────────────────────────────────────────── */
    const sellerIdx = game.players.findIndex(
      (p) => p.uid === auction.hostPlayerId,
    );
    const nextIdx = (sellerIdx + 1) % game.players.length;
    const nextUid = game.players[nextIdx].uid;

    /* ── Contar artista ───────────────────────────────────────────────── */
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

/* ════════════════════════════════════════════════════════════════════════ */
/* 4️⃣ Cancelar subasta (vendedor)                                          */
/* ════════════════════════════════════════════════════════════════════════ */
export async function cancelAuctionTransactional(
  gameId: string,
  uid: string,
): Promise<void> {
  await firestore().runTransaction(async (tx) => {
    const ref = gameRef(gameId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Partida no encontrada');
    const game = snap.data() as Game;

    const auction = game.auction;
    if (!auction) return;
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
