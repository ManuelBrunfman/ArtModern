// src/screens/AuctionScreen/AuctionScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Button,
} from 'react-native';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import AuctionTimer from './AuctionTimer';
import AuctionHeader from './AuctionHeader';
import AuctionStateInfo from './AuctionStateInfo';
import BidList from './BidList';
import BidInput from './BidInput';
import SellerActions from './SellerActions';
import TieBreakModal from './TieBreakModal';
import { checkAndAdvanceRound } from '../../utils/roundManager';

interface AuctionScreenProps { gameId: string; userId: string; }

type AuctionType = 'open' | 'sealed' | 'once' | 'fixed' | 'double';
interface Auction {
  artwork: string;
  artist: string;
  type: AuctionType;
  sellerId: string;
  bids: Record<string, number>;
  highestBid: number;
  highestBidder: string | null;
  turnIndex: number;
  fixedPrice: number;
  cardCount: number;
  tiedBidders?: string[];
}
interface Player { uid: string; name: string; money: number; }
interface GameData {
  round: number;
  players: Player[];
  currentTurn: string;
  currentTurnIndex: number;
  currentAuction?: Auction;
  artistCounts?: Record<string, number>;
}

export default function AuctionScreen({ gameId, userId }: AuctionScreenProps) {
  const [auction, setAuction] = useState<Auction | null>(null);
  const [game, setGame] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(20);
  const [tieModalVisible, setTieModalVisible] = useState(false);
  const [tieBidders, setTieBidders] = useState<string[]>([]);
  const [bidSent, setBidSent] = useState(false);
  const [priceInput, setPriceInput] = useState('');

  // --- Firestore listener ---
  useEffect(() => {
    const ref = firestore().doc(`games/${gameId}`);
    const unsubscribe = ref.onSnapshot((doc: FirebaseFirestoreTypes.DocumentSnapshot) => {
      const data = doc.data() as GameData | undefined;
      setGame(data ?? null);
      setAuction(data?.currentAuction ?? null);
      setLoading(false);
      if (data?.currentAuction) {
        const t = data.currentAuction.type;
        setTimeLeft(t === 'once' ? 15 : t === 'double' ? 25 : t === 'sealed' ? 30 : 20);
      }
    });
    return unsubscribe;
  }, [gameId]);

  // Reset feedback cuando cambia la subasta
  useEffect(() => {
    setBidSent(false);
  }, [auction]);

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" /></View>;
  if (!game || !auction) return <View style={styles.centered}><Text>No hay subasta.</Text></View>;

  const { players, artistCounts } = game;
  const isSeller = auction.sellerId === userId;
  const userMoney = players.find(p => p.uid === userId)?.money || 0;

  const playerName = (uid: string | null) => {
    if (!uid) return 'Nadie';
    const p = players.find(p => p.uid === uid);
    return p?.name ?? 'Desconocido';
  };

  // ---------- BID HANDLER ----------
  const handleBid = async (amount: number) => {
    if (!auction) return;

    if ((auction.type === 'open' || auction.type === 'double') && amount <= auction.highestBid) {
      return Alert.alert('Oferta insuficiente', 'Debe superar la oferta actual.');
    }
    if ((auction.type === 'once' || auction.type === 'sealed') && auction.bids[userId] !== undefined) {
      return Alert.alert('Ya enviaste tu puja');
    }
    if (amount > userMoney) {
      return Alert.alert('Fondos insuficientes');
    }

    const newBids = { ...auction.bids, [userId]: amount };
    const upd: Partial<Auction> = { bids: newBids };
    if (auction.type === 'open' || auction.type === 'double') {
      upd.highestBid = amount;
      upd.highestBidder = userId;
    }
    await firestore().doc(`games/${gameId}`).update({ currentAuction: { ...auction, ...upd } });
    setBidSent(true);
  };

  // ---------- SET PRICE FOR FIXED ----------
  const setFixedPrice = async () => {
    const price = parseInt(priceInput, 10);
    if (isNaN(price) || price <= 0) return Alert.alert('Precio inválido');
    await firestore().doc(`games/${gameId}`).update({ currentAuction: { ...auction, fixedPrice: price } });
    setPriceInput('');
  };

  // ---------- FINISH / CANCEL / TIE ----------
  const cancelAuction = async () => {
    await firestore().doc(`games/${gameId}`).update({ currentAuction: firestore.FieldValue.delete() });
  };

  const handleResolveTie = (winnerId: string) => {
    setTieModalVisible(false);
    handleFinish(winnerId);
  };

  const handleFinish = async (forcedWinnerId?: string) => {
    if (!auction || !game) return;

    let winner: string | null = forcedWinnerId ?? null;
    let bidValue = 0;
    const bidsArr = Object.entries(auction.bids);

    switch (auction.type) {
      case 'open':
      case 'double':
        winner = auction.highestBidder;
        bidValue = auction.highestBid;
        break;
      case 'fixed':
        if (bidsArr.length > 0) {
          winner = auction.highestBidder;
          bidValue = auction.fixedPrice;
        } else {
          winner = auction.sellerId;
          bidValue = Math.floor(auction.fixedPrice / 2);
        }
        break;
      case 'sealed':
      case 'once':
        if (bidsArr.length === 0) {
          await cancelAuction();
          return;
        }
        if (!winner) {
          bidsArr.sort((a, b) => b[1] - a[1]);
          const highest = bidsArr[0][1];
          const ties = bidsArr.filter(([, v]) => v === highest).map(([id]) => id);
          if (ties.length > 1 && auction.type === 'sealed') {
            setTieBidders(ties);
            setTieModalVisible(true);
            return;
          }
          winner = ties.length > 1 ? ties[Math.floor(Math.random() * ties.length)] : ties[0];
          bidValue = highest;
        }
        break;
    }

    if (!winner) {
      await cancelAuction();
      return;
    }

    const updatedPlayers = players.map(p => {
      if (p.uid === winner) return { ...p, money: p.money - bidValue };
      if (p.uid === auction.sellerId) return { ...p, money: p.money + bidValue };
      return p;
    });

    const sellerIndex = players.findIndex(p => p.uid === auction.sellerId);
    const nextIndex   = (sellerIndex + 1) % players.length;
    const newCounts   = { ...(artistCounts || {}), [auction.artist]: (artistCounts?.[auction.artist] || 0) + auction.cardCount };

    await firestore().doc(`games/${gameId}`).update({
      players: updatedPlayers,
      currentAuction: firestore.FieldValue.delete(),
      currentTurn: players[nextIndex].uid,
      currentTurnIndex: nextIndex,
      artistCounts: newCounts,
    });
    await checkAndAdvanceRound(gameId);
  };

  // ---------- RENDER ----------
  const canSetPrice = isSeller && auction.type === 'fixed' && Object.keys(auction.bids).length === 0;

  return (
    <View style={styles.container}>
      <AuctionHeader artwork={auction.artwork} artist={auction.artist} typeName={auction.type} />

      <AuctionTimer duration={timeLeft} timeLeft={timeLeft} onTimeout={() => (isSeller ? handleFinish() : undefined)} />

      <AuctionStateInfo
        type={auction.type}
        highestBid={auction.highestBid}
        highestBidder={auction.highestBidder ?? undefined}
        bidsReceived={Object.keys(auction.bids).length}
        totalPlayers={players.length}
      />

      <BidList
        bids={auction.bids}
        visible={['open', 'once', 'double'].includes(auction.type)}
        getPlayerName={playerName}
      />

      {canSetPrice && (
        <View style={styles.priceContainer}>
          <Text>Precio fijo: </Text>
          <TextInput
            style={styles.priceInput}
            value={priceInput}
            onChangeText={setPriceInput}
            keyboardType="numeric"
          />
          <Button title="Fijar precio" onPress={setFixedPrice} />
        </View>
      )}

      {!isSeller && !canSetPrice && (
        bidSent && (auction.type === 'sealed' || auction.type === 'once') ? (
          <Text style={styles.sentMsg}>✅ Puja enviada</Text>
        ) : (
          <BidInput
            type={auction.type}
            fixedPrice={auction.fixedPrice}
            onSubmit={handleBid}
            disabled={(auction.type === 'sealed' || auction.type === 'once') && auction.bids[userId] !== undefined}
          />
        )
      )}

      {isSeller && !canSetPrice && (
        <SellerActions
          type={auction.type}
          onFinish={() => handleFinish()}
          onCancel={cancelAuction}
          onReveal={() => handleFinish()}
        />
      )}

      <TieBreakModal
        visible={tieModalVisible}
        tiedBidders={tieBidders}
        bids={auction.bids}
        getPlayerName={playerName}
        onResolve={handleResolveTie}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  priceContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  priceInput: { borderWidth: 1, borderColor: '#999', padding: 4, width: 80, marginHorizontal: 8, borderRadius: 4 },
  sentMsg: { textAlign: 'center', marginTop: 10, color: '#4CAF50', fontWeight: '600' },
});
