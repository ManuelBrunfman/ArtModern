// src/screens/AuctionScreen/AuctionScreen.tsx

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';

import AuctionHeader from './AuctionHeader';
import AuctionTimer from './AuctionTimer';
import AuctionStateInfo from './AuctionStateInfo';
import BidList from './BidList';
import BidInput from './BidInput';
import SellerActions from './SellerActions';
import TieBreakModal from './TieBreakModal';

import {
  placeBidTransactional,
  finishAuctionTransactional,
  cancelAuctionTransactional,
} from '../../services/auctionService';

import type { Game, Auction, Bid, Player } from '../../types/game';

/* ── Mapeo único: solo abierta ↔ open ── */
const toEN: Record<'abierta', 'open'> = {
  abierta: 'open',
};

/* ── Hook de cuenta atrás ── */
const useCountdown = (
  active: boolean,
  seconds: number,
  onZero: () => void
) => {
  const [time, setTime] = useState(seconds);
  useEffect(() => {
    if (!active) return;
    setTime(seconds);
    const id = setInterval(() => {
      setTime((t) => {
        if (t <= 1) {
          clearInterval(id);
          onZero();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [active, seconds, onZero]);
  return { time, reset: () => setTime(seconds) };
};

/* ── Componente │ AuctionScreen ── */
export default function AuctionScreen({
  route,
}: {
  route: { params: { gameId: string; userId: string } };
}) {
  const { gameId, userId } = route.params;
  const [game, setGame] = useState<Game | null>(null);
  const [auction, setAuction] = useState<Auction | null>(null);
  const [loading, setLoading] = useState(true);

  const { time, reset } = useCountdown(
    !!auction,
    20,
    () => auction?.hostPlayerId === userId && finishAuction()
  );

  useEffect(() => {
    const unsub = firestore()
      .doc(`games/${gameId}`)
      .onSnapshot((snap) => {
        const g = snap.exists ? (snap.data() as Game) : null;
        setGame(g);
        setAuction(g?.auction ?? null);
        setLoading(false);
      });
    return unsub;
  }, [gameId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (!game || !auction) {
    return (
      <View style={styles.center}>
        <Text>No hay subasta activa</Text>
      </View>
    );
  }

  const players = game.players;
  const isSeller = auction.hostPlayerId === userId;
  const me = players.find((p) => p.uid === userId) as Player;
  const highestBidAmount = auction.highestBid?.amount ?? 0;
  const highestBidderId = auction.highestBid?.playerId ?? '';
  const alreadyBid = auction.bids.some((b) => b.playerId === userId);

  const bidsRecord: Record<string, number> = auction.bids.reduce(
    (m, b) => ({ ...m, [b.playerId]: b.amount }),
    {}
  );

  const getPlayerName = (uid: string) =>
    players.find((p) => p.uid === uid)?.name ?? '';

  const validateBid = (amount: number): string | null => {
    if (!me) return 'No hay usuario';
    if (amount <= 0) return 'Oferta inválida';
    if (amount > me.money) return 'Saldo insuficiente';
    if (amount <= highestBidAmount) return 'Debe superar la oferta actual';
    if (highestBidderId === userId) return 'Ya sos el mejor postor';
    return null;
  };

  const placeBid = async (amount: number) => {
    const err = validateBid(amount);
    if (err) return Alert.alert('Rechazada', err);
    try {
      await placeBidTransactional(gameId, userId, amount);
      reset();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const finishAuction = useCallback(async () => {
    try {
      await finishAuctionTransactional(gameId);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }, [gameId]);

  const cancelAuction = async () => {
    try {
      await cancelAuctionTransactional(gameId, userId);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <View style={styles.container}>
      <AuctionHeader
        artwork={auction.card.id}
        artist={auction.card.artist}
        typeName={toEN[auction.type]}
      />
      <AuctionTimer duration={20} timeLeft={time} />
      <AuctionStateInfo
        auctionType={toEN[auction.type]}
        highestBid={highestBidAmount}
        highestBidder={getPlayerName(highestBidderId)}
        bidsReceived={auction.bids.length}
        totalPlayers={players.length}
      />
      <BidList
        bids={bidsRecord}
        visible={true}
        getPlayerName={getPlayerName}
      />
      {!isSeller && (
        <BidInput
          type="open"
          fixedPrice={0}
          currentMoney={me.money}
          disabled={alreadyBid}
          onSubmit={placeBid}
        />
      )}
      {isSeller && (
        <SellerActions
          type={toEN[auction.type]}
          onFinish={finishAuction}
          onCancel={cancelAuction}
        />
      )}
      <TieBreakModal
        visible={false}
        tiedBidders={[]}
        bids={bidsRecord}
        getPlayerName={getPlayerName}
        onResolve={() => finishAuction()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
