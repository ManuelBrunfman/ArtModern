/**
 * ==========================================================================
 * AuctionScreen.tsx   –   ahora permite pujas múltiples en “abierta/doble”
 * ==========================================================================
 */

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

import type { Game, Auction, Bid, AuctionType } from '../../types/game';

/* ─────────────── mapeo ES → EN para componentes viejos ─────────────── */
const EN: Record<AuctionType, string> = {
  'abierta': 'open',
  'cerrada': 'sealed',
  'una-vuelta': 'once',
  'fija': 'fixed',
  'doble': 'double',
};

/* ─────────────── Timer sencillo ─────────────── */
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

/* ─────────────── Componente ─────────────── */
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

  /* ------- listener ------- */
  useEffect(() => {
    const unsub = firestore()
      .doc(`games/${gameId}`)
      .onSnapshot((s) => {
        const g = s.exists ? (s.data() as Game) : null;
        setGame(g);
        setAuction(g?.auction ?? null);
        setLoading(false);
      });
    return unsub;
  }, [gameId]);

  /* ------- timer ------- */
  const { t: seconds, reset } = useCountdown(
    !!auction,
    20,
    () =>
      auction &&
      auction.hostPlayerId === userId &&
      finishAuction(),
  );

  /* ------- helpers ------- */
  const bidsRec: Record<string, number> = (auction?.bids ?? []).reduce(
    (map, b) => ({ ...map, [b.playerId]: b.amount }),
    {},
  );
  const highestBid = auction?.highestBid ?? null;
  const me = game?.players.find((p) => p.uid === userId);
  const alreadyBid =
    auction?.bids.some((b) => b.playerId === userId) ?? false;

  /* ------- validación ------- */
  const validate = (amt: number): string | null => {
    if (!auction || !me) return 'No hay subasta';
    if (amt <= 0) return 'Oferta inválida';
    if (amt > me.money) return 'Saldo insuficiente';

    switch (auction.type) {
      case 'abierta':
      case 'doble':
        if (amt <= (highestBid?.amount ?? 0))
          return 'Debe superar la puja actual';
        if (highestBid?.playerId === userId) return 'Ya sos el mejor postor';
        return null;

      case 'una-vuelta':
        if (alreadyBid) return 'Ya ofertaste en esta subasta';
        return null;

      case 'cerrada':
        return null; /* puede sobrescribir */

      case 'fija':
        if (amt !== (auction.fixedPrice ?? 0))
          return 'Debes pagar exactamente el precio fijo';
        return null;

      default:
        return 'Tipo de subasta no soportado';
    }
  };

  /* ------- acciones ------- */
  const bid = async (amt: number) => {
    const err = validate(amt);
    if (err) return Alert.alert('Rechazada', err);
    try {
      await placeBidTransactional(gameId, userId, amt);
      reset(); // reinicia siempre
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

  const setFixed = async () => {
    const p = parseInt(priceInput, 10);
    if (isNaN(p) || p <= 0) return Alert.alert('Número inválido');
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

  const finishAuction = useCallback(
    async () => finishAuctionTransactional(gameId),
    [gameId],
  );

  const cancelAuction = async () =>
    cancelAuctionTransactional(gameId, userId);

  /* ------- early UI ------- */
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
  const canSetPrice =
    isSeller &&
    auction.type === 'fija' &&
    !auction.fixedPrice &&
    auction.bids.length === 0;

  /* ------- render ------- */
  return (
    <View style={styles.container}>
      <AuctionHeader
        artwork={auction.card.id}
        artist={auction.card.artist}
        typeName={EN[auction.type]}
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
        fixedPrice={auction.fixedPrice}
      />

      <BidList
        bids={bidsRec}
        visible={['abierta', 'doble'].includes(auction.type)}
        getPlayerName={(uid) => game.players.find((p) => p.uid === uid)?.name!}
      />

      {/* vendedor fija precio */}
      {canSetPrice && (
        <View style={styles.row}>
          <TextInput
            style={styles.input}
            placeholder="€"
            keyboardType="number-pad"
            value={priceInput}
            onChangeText={setPriceInput}
          />
          <Button title="Fijar" onPress={setFixed} />
        </View>
      )}

      {/* comprador */}
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
  type={EN[auction.type] as any}
  fixedPrice={auction.fixedPrice ?? 0}
  currentMoney={me?.money ?? 0}  
  disabled={
    alreadyBid && auction.type === 'una-vuelta'
  }
  onSubmit={bid}
/>
        ))}

      {/* acciones vendedor */}
      {isSeller && !canSetPrice && (
        <SellerActions
          type={EN[auction.type] as any}
          onFinish={finishAuction}
          onCancel={cancelAuction}
          onReveal={finishAuction}
        />
      )}

      {/* empate (futuro) */}
      <TieBreakModal
        visible={false}
        tiedBidders={[]}
        bids={bidsRec}
        getPlayerName={(uid) => game.players.find((p) => p.uid === uid)?.name!}
        onResolve={() => finishAuction()}
      />
    </View>
  );
}

/* ───────── estilos ───────── */
const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row', gap: 8, marginVertical: 8, alignItems: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: 4,
    paddingHorizontal: 8,
    width: 90,
  },
});
