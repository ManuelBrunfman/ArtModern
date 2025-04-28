// ──────────────────────────────────────────────────────────────────────────
// AuctionScreen.tsx  –  alineado a tipos reales + fixedPrice definido
// ──────────────────────────────────────────────────────────────────────────

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
  acceptFixedPriceTransactional,
  finishAuctionTransactional,
  cancelAuctionTransactional,
} from '../../services/auctionService';

import type {
  Game,
  Auction,
  Bid,
  AuctionType,
} from '../../types/game';

/* ─────────────── Mapeos utilitarios ──────────────── */
const toEN: Record<AuctionType, string> = {
  'abierta': 'open',
  'cerrada': 'sealed',
  'una-vuelta': 'once',
  'fija': 'fixed',
  'doble': 'double',
};
const toES = (t: string): AuctionType =>
  (Object.entries(toEN).find(([, en]) => en === t)?.[0] ??
    t) as AuctionType;

/* ─────────────── Hook de cuenta regresiva ─────────────── */
const useCountdown = (
  active: boolean,
  seconds: number,
  onZero: () => void,
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
    }, 1_000);
    return () => clearInterval(id);
  }, [active, seconds, onZero]);
  return { time, reset: () => setTime(seconds) };
};

/* ─────────────────── Componente ─────────────────── */
export default function AuctionScreen({
  route,
}: {
  route: { params: { gameId: string; userId: string } };
}) {
  const { gameId, userId } = route.params;

  const [game, setGame] = useState<Game | null>(null);
  const [auction, setAuction] = useState<Auction | null>(null);
  const [loading, setLoading] = useState(true);
  const [priceInput, setPriceInput] = useState('');

  /* =================== Firestore listener =================== */
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

  /* =================== Timer =================== */
  const { time, reset } = useCountdown(
    !!auction,
    20,
    () =>
      auction &&
      auction.hostPlayerId === userId &&
      finishAuction(),
  );

  /* =================== Helpers =================== */
  const bidsRecord: Record<string, number> = (auction?.bids ?? []).reduce(
    (map, b) => {
      map[b.playerId] = b.amount;
      return map;
    },
    {} as Record<string, number>,
  );

  const highestBidAmount = auction?.highestBid?.amount ?? 0;
  const highestBidderId = auction?.highestBid?.playerId ?? '';
  const alreadyBid = auction?.bids.some((b) => b.playerId === userId) ?? false;
  const me = game?.players.find((p) => p.uid === userId);

  /* =================== Validaciones =================== */
  const validateBid = (amount: number): string | null => {
    if (!auction || !me) return 'No hay subasta';
    if (amount <= 0) return 'Oferta inválida';
    if (amount > me.money) return 'Saldo insuficiente';

    const type = auction.type;
    if (type === 'abierta' || type === 'doble') {
      if (amount <= highestBidAmount) return 'Debe superar la oferta actual';
      if (highestBidderId === userId) return 'Ya sos el mejor postor';
    }
    if (
      (type === 'una-vuelta' || type === 'cerrada') &&
      alreadyBid
    )
      return 'Solo una oferta en esta subasta';
    if (type === 'fija' && amount !== (auction.fixedPrice ?? 0))
      return 'Debes pagar exactamente el precio fijo';
    return null;
  };

  /* =================== Acciones =================== */
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

  const buyFixed = async () => {
    try {
      await acceptFixedPriceTransactional(gameId, userId);
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

  const setFixedPrice = async () => {
    const p = parseInt(priceInput, 10);
    if (isNaN(p) || p <= 0) return Alert.alert('Precio inválido');
    try {
      await firestore()
        .doc(`games/${gameId}`)
        .update({ 'auction.fixedPrice': p });
      setPriceInput('');
      reset();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  /* =================== Early UI =================== */
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

  /* =================== Derivados de render =================== */
  const players = game.players;
  const isSeller = auction.hostPlayerId === userId;
  const canSetPrice =
    isSeller &&
    auction.type === 'fija' &&
    !auction.fixedPrice &&
    auction.bids.length === 0;

  /* =================== UI =================== */
  return (
    <View style={styles.container}>
      <AuctionHeader
        artwork={auction.card.id}
        artist={auction.card.artist}
        typeName={toEN[auction.type]}
      />

      <AuctionTimer duration={20} timeLeft={time} />

      <AuctionStateInfo
        auctionType={toEN[auction.type] as any}
        highestBid={highestBidAmount}
        highestBidder={
          players.find((p) => p.uid === highestBidderId)?.name
        }
        bidsReceived={auction.bids.length}
        totalPlayers={players.length}
        fixedPrice={auction.fixedPrice}
      />

      <BidList
        bids={bidsRecord}
        visible={['abierta', 'doble'].includes(auction.type)}
        getPlayerName={(uid) => players.find((p) => p.uid === uid)?.name ?? ''}
      />

      {/* Vendedor fija precio */}
      {canSetPrice && (
        <View style={styles.row}>
          <TextInput
            style={styles.input}
            placeholder="€"
            keyboardType="number-pad"
            value={priceInput}
            onChangeText={setPriceInput}
          />
          <Button title="Fijar" onPress={setFixedPrice} />
        </View>
      )}

      {/* Comprador: pujar o comprar precio fijo */}
      {!isSeller &&
        (auction.type === 'fija' ? (
          <Button
            title={`Comprar (€${auction.fixedPrice})`}
            onPress={buyFixed}
            disabled={
              alreadyBid || (auction.fixedPrice ?? 0) > (me?.money ?? 0)
            }
          />
        ) : (
          <BidInput
            type={toEN[auction.type] as any}
            fixedPrice={auction.fixedPrice ?? 0} 
            currentMoney={me?.money ?? 0}
            disabled={alreadyBid}
            onSubmit={placeBid}
          />
        ))}

      {/* Acciones del vendedor */}
      {isSeller && !canSetPrice && (
        <SellerActions
          type={toEN[auction.type] as any}
          onFinish={finishAuction}
          onCancel={cancelAuction}
          onReveal={finishAuction}
        />
      )}

      {/* Empate (placeholder) */}
      <TieBreakModal
        visible={false}
        tiedBidders={[]}
        bids={bidsRecord}
        getPlayerName={(uid) => players.find((p) => p.uid === uid)?.name ?? ''}
        onResolve={() => finishAuction()}
      />
    </View>
  );
}

/* ─────────────── Estilos ─────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: 4,
    paddingHorizontal: 8,
    width: 90,
  },
});
