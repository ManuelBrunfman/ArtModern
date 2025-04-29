import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  StyleSheet,
  Text,
  TextInput,
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

import type { Game, Auction, Bid } from '../../types/game';

const EN: Record<string, string> = {
  abierta: 'open',
  doble: 'double',
  // Otros tipos en inglés si los habilitas luego
};

const useCountdown = (active: boolean, secs: number, cb: () => void) => {
  const [t, setT] = useState(secs);
  useEffect(() => {
    if (!active) return;
    setT(secs);
    const id = setInterval(() => {
      setT((x) => {
        if (x <= 1) {
          clearInterval(id);
          cb();
          return 0;
        }
        return x - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [active, secs, cb]);
  return { t, reset: () => setT(secs) };
};

export default function AuctionScreen({ route }: { route: { params: { gameId: string; userId: string } } }) {
  const { gameId, userId } = route.params;

  const [game, setGame] = useState<Game | null>(null);
  const [auction, setAuction] = useState<Auction | null>(null);
  const [loading, setLoading] = useState(true);
  const [priceInput, setPriceInput] = useState('');

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

  const { t: seconds, reset } = useCountdown(
    !!auction,
    20,
    () => auction && auction.hostPlayerId === userId && finishAuction(),
  );

  const bidsRec: Record<string, number> = (auction?.bids ?? []).reduce(
    (m, b) => ({ ...m, [b.playerId]: b.amount }),
    {},
  );
  const highestBid = auction?.highestBid;
  const meMoney = game?.players.find((p) => p.uid === userId)?.money ?? 0;
  const alreadyBid = auction?.bids.some((b) => b.playerId === userId) ?? false;

  const validate = (amt: number): string | null => {
    if (!auction) return 'No hay subasta';
    if (amt <= 0) return 'Oferta inválida';
    if (amt > meMoney) return 'Saldo insuficiente';
    const current = highestBid?.amount ?? 0;
    if (amt <= current) return 'Debe superar la puja actual';
    if (highestBid?.playerId === userId) return 'Ya sos el mejor postor';
    return null;
  };

  const bid = async (amt: number) => {
    const err = validate(amt);
    if (err) return Alert.alert('Rechazada', err);
    try {
      await placeBidTransactional(gameId, userId, amt);
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

  const cancel = async () => cancelAuctionTransactional(gameId, userId);

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  if (!game || !auction)
    return (
      <View style={styles.center}>
        <Text>No hay subasta activa</Text>
      </View>
    );

  const isSeller = auction.hostPlayerId === userId;
  return (
    <View style={styles.container}>
      <AuctionHeader
        artwork={auction.card.id}
        artist={auction.card.artist}
        typeName={EN[auction.type] || 'open'}
      />
      <AuctionTimer duration={20} timeLeft={seconds} />
      <AuctionStateInfo
        auctionType={EN[auction.type] as any}
        highestBid={highestBid?.amount ?? 0}
        highestBidder={
          game.players.find((p) => p.uid === highestBid?.playerId)?.name
        }
        bidsReceived={auction.bids.length}
        totalPlayers={game.players.length}
      />
      <BidList
        bids={bidsRec}
        visible={true}
        getPlayerName={(uid) => game.players.find((p) => p.uid === uid)?.name!}
      />
      {!isSeller ? (
        <BidInput
          type="open"
          fixedPrice={0}
          currentMoney={meMoney}
          disabled={false}
          onSubmit={bid}
        />
      ) : (
        <SellerActions
          type="open"
          onFinish={finishAuction}
          onCancel={cancel}
          onReveal={finishAuction}
        />
      )}
      <TieBreakModal visible={false} tiedBidders={[]} bids={bidsRec} getPlayerName={(uid) => game.players.find((p) => p.uid === uid)?.name!} onResolve={() => finishAuction()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});