// src/screens/AuctionScreen/AuctionScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import AuctionTimer from './AuctionTimer';
import AuctionHeader from './AuctionHeader';
import AuctionStateInfo from './AuctionStateInfo';
import BidList from './BidList';
import BidInput from './BidInput';
import SellerActions from './SellerActions';
import { checkAndAdvanceRound } from '../../utils/roundManager';

interface AuctionScreenProps {
  gameId: string;
  userId: string;
}

interface Auction {
  artwork: string;
  artist: string;
  type: 'abierta';
  sellerId: string;
  bids: Record<string, number>;
  highestBid: number;
  highestBidder: string | null;
  turnIndex: number;
  cardCount: number;
}

interface Player {
  uid: string;
  name: string;
  money: number;
}

interface GameData {
  round: number;
  players: Player[];
  currentTurn: string;
  currentTurnIndex: number;
  currentAuction?: Auction;
  artistCounts?: Record<string, number>;
}

export default function AuctionScreen({ gameId, userId }: AuctionScreenProps) {
  const DURATION = 5; // segundos de cada conteo

  const [auction, setAuction] = useState<Auction | null>(null);
  const [game, setGame] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [bidSent, setBidSent] = useState(false);

  // Listener Firestore: carga inicial o nueva subasta
  useEffect(() => {
    const ref = firestore().doc(`games/${gameId}`);
    const unsubscribe = ref.onSnapshot((doc: FirebaseFirestoreTypes.DocumentSnapshot) => {
      const data = doc.data() as GameData | undefined;
      setGame(data ?? null);
      setAuction(data?.currentAuction ?? null);
      setLoading(false);
      // Reinicio timer y bloqueo input al arrancar subasta
      setTimeLeft(DURATION);
      setBidSent(false);
    });
    return unsubscribe;
  }, [gameId]);

  // Contador real: decrementa timeLeft cada segundo mientras haya subasta activa
  useEffect(() => {
    if (!auction) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1;
        if (next <= 0) clearInterval(interval);
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [auction]);

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" /></View>;
  if (!game || !auction) return <View style={styles.centered}><Text>No hay subasta.</Text></View>;

  const { players } = game;
  const isSeller = auction.sellerId === userId;
  const userMoney = players.find(p => p.uid === userId)?.money || 0;
  const playerName = (uid: string | null) => {
    if (!uid) return 'Nadie';
    const p = players.find(p => p.uid === uid);
    return p?.name ?? 'Desconocido';
  };

  // Ofertar con incremento mínimo 10 % y reinicio de timer
  const handleBid = async (amount: number) => {
    if (!auction) return;
    const incremento = Math.ceil(auction.highestBid * 0.1);
    const mínimo = auction.highestBid + incremento;
    if (amount < mínimo) {
      return Alert.alert(
        'Oferta insuficiente',
        `Debe ser al menos 10 % mayor: mínimo $${mínimo}.`
      );
    }
    if (amount > userMoney) {
      return Alert.alert('Fondos insuficientes');
    }

    const newBids = { ...auction.bids, [userId]: amount };
    const upd: Partial<Auction> = {
      bids: newBids,
      highestBid: amount,
      highestBidder: userId,
    };
    await firestore().doc(`games/${gameId}`)
      .update({ currentAuction: { ...auction, ...upd } });

    setBidSent(true);
    setTimeLeft(DURATION); // reinicio timer tras puja
  };

  // Cerrar subasta open
  const handleFinish = async () => {
    if (!auction || !game) return;
    const winner = auction.highestBidder;
    const bidValue = auction.highestBid;
    if (!winner) {
      // nadie pujó
      await firestore().doc(`games/${gameId}`)
        .update({ currentAuction: firestore.FieldValue.delete() });
    } else {
      const updatedPlayers = players.map(p => {
        if (p.uid === winner) return { ...p, money: p.money - bidValue };
        if (p.uid === auction.sellerId) return { ...p, money: p.money + bidValue };
        return p;
      });
      const sellerIndex = players.findIndex(p => p.uid === auction.sellerId);
      const nextIndex = (sellerIndex + 1) % players.length;
      await firestore().doc(`games/${gameId}`)
        .update({
          players: updatedPlayers,
          currentAuction: firestore.FieldValue.delete(),
          currentTurn: players[nextIndex].uid,
          currentTurnIndex: nextIndex,
        });
      await checkAndAdvanceRound(gameId);
    }
  };

  const canBid = !isSeller;
  const canFinish = isSeller;

  return (
    <View style={styles.container}>
      <AuctionHeader
        artwork={auction.artwork}
        artist={auction.artist}
        typeName="Abierta"
      />

      <AuctionTimer
        duration={DURATION}
        timeLeft={timeLeft}
        onTimeout={() => canFinish && handleFinish()}
      />

      <AuctionStateInfo
        highestBid={auction.highestBid}
        highestBidder={auction.highestBidder ?? undefined}
      />

      <BidList
        bids={auction.bids}
        visible={true}
        getPlayerName={playerName}
      />

      {canBid && (
        bidSent
          ? <Text style={styles.sentMsg}>✅ Puja enviada</Text>
          : (
              <BidInput
                type={auction.type}
                onSubmit={handleBid}
                disabled={bidSent}
              />
            )
      )}

      {canFinish && (
        <SellerActions
          type={auction.type}
          onFinish={() => { handleFinish(); }}
          onCancel={() => {
            firestore().doc(`games/${gameId}`)
              .update({ currentAuction: firestore.FieldValue.delete() });
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sentMsg: { textAlign: 'center', marginTop: 10, color: '#4CAF50', fontWeight: '600' },
});
