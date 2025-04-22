import firestore from '@react-native-firebase/firestore';
import { checkAndAdvanceRound } from '../utils/roundManager';

/**
 * Registra una puja abierta, sellada o una vuelta.
 */
export const placeBidTransactional = async ({
  gameId,
  userId,
  amount,
}: {
  gameId: string;
  userId: string;
  amount: number;
}) => {
  const gameRef = firestore().collection('games').doc(gameId);

  await firestore().runTransaction(async (tx) => {
    const doc = await tx.get(gameRef);
    const game = doc.data();
    if (!game) throw new Error('Juego no encontrado');

    const player = game.players.find((p: any) => p.uid === userId);
    if (!player) throw new Error('Jugador inválido');
    if (player.money < amount) throw new Error('Saldo insuficiente');

    const auction = game.currentAuction;
    if (!auction) throw new Error('No hay subasta activa');

    switch (auction.type) {
      case 'open':
        if (amount <= auction.highestBid) throw new Error('Debe superar la puja actual');
        tx.update(gameRef, {
          'currentAuction.highestBid': amount,
          'currentAuction.highestBidder': userId,
        });
        break;

      case 'sealed':
        tx.update(gameRef, {
          [`currentAuction.bids.${userId}`]: amount,
        });
        break;

      case 'once':
        const nextIndex = auction.turnIndex + 1;
        tx.update(gameRef, {
          [`currentAuction.bids.${userId}`]: amount,
          'currentAuction.turnIndex': nextIndex,
        });
        break;

      default:
        throw new Error('Tipo de subasta no soportado');
    }
  });
};

/**
 * Finaliza una subasta: asigna la obra al ganador, paga y cobra, y avanza ronda si corresponde.
 */
export const finishAuctionTransactional = async (gameId: string) => {
  const gameRef = firestore().collection('games').doc(gameId);

  await firestore().runTransaction(async (tx) => {
    const doc = await tx.get(gameRef);
    const game = doc.data();
    if (!game) throw new Error('Juego no encontrado');

    const auction = game.currentAuction;
    if (!auction) return;

    const bids = auction.bids || {};
    let winner = null;
    let max = -1;

    for (const [uid, val] of Object.entries(bids)) {
      const value = val as number;
      if (value > max) {
        max = value;
        winner = uid;
      }
    }

    if (!winner) {
      tx.update(gameRef, {
        currentAuction: firestore.FieldValue.delete(),
      });
      return;
    }

    const artworks = auction.artwork.split(' + ').map((title: string) => ({
      title,
      artist: auction.artist,
    }));

    const updatedPlayers = game.players.map((p: any) => {
      if (p.uid === winner) {
        return {
          ...p,
          money: p.money - max,
          collection: [...(p.collection || []), ...artworks],
        };
      }
      if (p.uid === auction.sellerId) {
        return { ...p, money: p.money + max };
      }
      return p;
    });

    const newArtistCounts = { ...(game.artistCounts || {}) };
    newArtistCounts[auction.artist] = (newArtistCounts[auction.artist] || 0) + 1;

    tx.update(gameRef, {
      players: updatedPlayers,
      currentAuction: firestore.FieldValue.delete(),
      currentTurn: auction.sellerId,
      artistCounts: newArtistCounts,
    });
  });

  // Se ejecuta por fuera de la transacción
  await checkAndAdvanceRound(gameId);
};

/**
 * Para subasta fija: cobra al comprador, paga al vendedor y entrega obra.
 */
export const acceptFixedPriceTransactional = async ({
  gameId,
  buyerId,
}: {
  gameId: string;
  buyerId: string;
}) => {
  const gameRef = firestore().collection('games').doc(gameId);

  await firestore().runTransaction(async (tx) => {
    const doc = await tx.get(gameRef);
    const game = doc.data();
    if (!game) throw new Error('Juego no encontrado');

    const auction = game.currentAuction;
    if (!auction || auction.type !== 'fixed') throw new Error('No es subasta fija');

    const price = auction.fixedPrice;

    const updatedPlayers = game.players.map((p: any) => {
      if (p.uid === buyerId) {
        if (p.money < price) throw new Error('Saldo insuficiente');
        return { ...p, money: p.money - price, collection: [...(p.collection || []), {
          title: auction.artwork,
          artist: auction.artist,
        }] };
      }
      if (p.uid === auction.sellerId) {
        return { ...p, money: p.money + price };
      }
      return p;
    });

    const newArtistCounts = { ...(game.artistCounts || {}) };
    newArtistCounts[auction.artist] = (newArtistCounts[auction.artist] || 0) + 1;

    tx.update(gameRef, {
      players: updatedPlayers,
      currentAuction: firestore.FieldValue.delete(),
      artistCounts: newArtistCounts,
      currentTurn: auction.sellerId,
    });
  });

  await checkAndAdvanceRound(gameId);
};
