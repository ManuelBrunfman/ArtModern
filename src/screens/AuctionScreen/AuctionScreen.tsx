// src/screens/AuctionScreen/AuctionScreen.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  Alert, TextInput, Button,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';

import AuctionHeader    from './AuctionHeader';
import AuctionTimer     from './AuctionTimer';
import AuctionStateInfo from './AuctionStateInfo';
import BidList          from './BidList';
import BidInput         from './BidInput';
import SellerActions    from './SellerActions';
import TieBreakModal    from './TieBreakModal';
import { checkAndAdvanceRound } from '../../utils/roundManager';

/* ─────────── Tipos ─────────── */
export type AuctionType = 'open' | 'sealed' | 'once' | 'fixed' | 'double';

interface Auction {
  artwork:string; artist:string; type:AuctionType; sellerId:string;
  bids:Record<string,number>; highestBid:number; highestBidder:string|null;
  fixedPrice:number; cardCount:number; tiedBidders?:string[];
}

interface Player { uid:string; name:string; money:number; }

interface GameData {
  round:number; players:Player[]; currentTurn:string; currentTurnIndex:number;
  currentAuction?:Auction; artistCounts:Record<string,number>;
}

interface Props { gameId:string; userId:string; }

/* ─────────── helpers ─────────── */
function advanceTurn(g: GameData, sellerId: string) {
  const idx = g.players.findIndex(p => p.uid === sellerId);
  const nextIdx = (idx + 1) % g.players.length;
  return { uid: g.players[nextIdx].uid, index: nextIdx };
}

const validateBid = (a: Auction, uid: string, amt: number, bal: number): string | null => {
  if (amt <= 0) return 'La oferta debe ser mayor que cero';
  if ((a.type === 'once' || a.type === 'sealed') && a.bids[uid] !== undefined)
    return 'Solo puedes ofertar una vez';
  if (amt > bal) return 'Fondos insuficientes';
  if ((a.type === 'open' || a.type === 'double') && amt <= a.highestBid)
    return 'Debes superar la oferta actual';
  if (a.type === 'fixed' && amt !== a.fixedPrice)
    return 'Debes pagar exactamente el precio fijo';
  return null;
};

const determineWinner = (a: Auction, players: Player[], forced?: string) => {
  let winner: string | null = forced ?? null;
  let price = 0;
  const bids = Object.entries(a.bids);

  const resolveTurnOrder = (ties: string[]) => {
    const sIdx = players.findIndex(p => p.uid === a.sellerId);
    return ties.sort((u, v) => {
      const dist = (id: string) =>
        (players.findIndex(p => p.uid === id) - sIdx + players.length) % players.length;
      return dist(u) - dist(v);
    })[0];
  };

  switch (a.type) {
    case 'open':
    case 'double':
      winner = a.highestBidder;
      price = a.highestBid;
      break;

    case 'fixed':
      if (bids.length) { winner = a.highestBidder; price = a.fixedPrice; }
      break;

    case 'sealed':
    case 'once':
      if (!bids.length) break;
      if (!winner) {
        bids.sort(([,v1],[,v2]) => v2 - v1);
        const max = bids[0][1];
        const ties = bids.filter(([,v]) => v === max).map(([id]) => id);
        winner = ties.length > 1
          ? (a.type === 'sealed' ? null : resolveTurnOrder(ties))
          : ties[0];
        price = max;
      }
      break;
  }
  return { winner, price };
};

/* ─────────── hook timer 10 s ─────────── */
const useTimer = (active: boolean, dur = 10, cb: () => void) => {
  const [t, setT] = useState(dur);
  const ref = useRef<NodeJS.Timeout>();
  const reset = () => setT(dur);

  useEffect(() => {
    if (!active) { ref.current && clearInterval(ref.current); return; }
    reset();
    ref.current && clearInterval(ref.current);
    ref.current = setInterval(() => setT(x => {
      if (x <= 1) cb();
      return x <= 1 ? 0 : x - 1;
    }), 1000);
    return () => ref.current && clearInterval(ref.current);
  }, [active, dur]);

  return { t, reset };
};

/* ─────────── componente ─────────── */
export default function AuctionScreen({ gameId, userId }: Props) {
  const [game, setGame] = useState<GameData | null>(null);
  const [auction, setAuction] = useState<Auction | null>(null);
  const [loading, setLoading] = useState(true);
  const [bidSent, setBidSent] = useState(false);
  const [priceInput, setPriceInput] = useState('');

  /* listener */
  useEffect(() =>
    firestore().doc(`games/${gameId}`).onSnapshot(snap => {
      if (!snap.exists) return;
      const g = snap.data() as GameData;
      setGame(g);
      setAuction(g.currentAuction ?? null);
      setLoading(false);
    }), [gameId]);

  /* finishAuction antes de usarlo en hooks */
  async function finishAuction(forcedWinner?: string) {
    await firestore().runTransaction(async tx => {
      const snap = await tx.get(firestore().doc(`games/${gameId}`));
      const g = snap.data() as GameData;
      const a = g.currentAuction!;
      const { winner, price } = determineWinner(a, g.players, forcedWinner);

      const turn = advanceTurn(g, a.sellerId);

      if (!winner) {                                     // sin venta
        tx.update(snap.ref, {
          currentTurn: turn.uid,
          currentTurnIndex: turn.index,
          currentAuction: firestore.FieldValue.delete(),
        });
        return;
      }

      const newPlayers = g.players.map(p =>
        p.uid === winner     ? { ...p, money: p.money - price } :
        p.uid === a.sellerId ? { ...p, money: p.money + price } : p
      );
      const newCounts = {
        ...g.artistCounts,
        [a.artist]: (g.artistCounts[a.artist] || 0) + a.cardCount,
      };

      tx.update(snap.ref, {
        players: newPlayers,
        artistCounts: newCounts,
        currentTurn: turn.uid,
        currentTurnIndex: turn.index,
        currentAuction: firestore.FieldValue.delete(),
      });
    });

    await checkAndAdvanceRound(gameId);
  }

  /* timer 10 s */
  const { t: timer, reset: resetTimer } = useTimer(
    !!auction, 10,
    () => auction && auction.sellerId === userId && finishAuction()
  );

  if (loading)
    return <View style={styles.c}><ActivityIndicator size="large" /></View>;

  if (!game || !auction)
    return <View style={styles.c}><Text>No hay subasta activa</Text></View>;

  /* shorthands */
  const players = game.players;
  const me = players.find(p => p.uid === userId)!;
  const isSeller = me.uid === auction.sellerId;
  const alreadyBid = auction.bids[userId] !== undefined;
  const canSetPrice = isSeller && auction.type === 'fixed' &&
    !Object.keys(auction.bids).length;              // SIN fixedPrice === 0

  /* acciones */
  const placeBid = async (amount: number) => {
    const err = validateBid(auction, userId, amount, me.money);
    if (err) { Alert.alert('Puja rechazada', err); return; }

    await firestore().runTransaction(async tx => {
      const snap = await tx.get(firestore().doc(`games/${gameId}`));
      const g = snap.data() as GameData;
      const a = g.currentAuction!;

      a.bids[userId] = amount;
      if (a.type === 'open' || a.type === 'double') {
        a.highestBid = amount;
        a.highestBidder = userId;
      }
      tx.update(snap.ref, { currentAuction: a });
    });

    setBidSent(true);
    resetTimer();
  };

  const setFixedPrice = async () => {
    const p = parseInt(priceInput, 10);
    if (isNaN(p) || p <= 0) { Alert.alert('Precio inválido'); return; }
    await firestore().doc(`games/${gameId}`)
      .update({ 'currentAuction.fixedPrice': p });
    setPriceInput('');
    resetTimer();
  };

  const cancelAuction = async () => {
    if (!isSeller) return;
    await firestore().runTransaction(async tx => {
      const snap = await tx.get(firestore().doc(`games/${gameId}`));
      const g = snap.data() as GameData;
      const turn = advanceTurn(g, userId);
      tx.update(snap.ref, {
        currentTurn: turn.uid,
        currentTurnIndex: turn.index,
        currentAuction: firestore.FieldValue.delete(),
      });
    });
  };

  /* render helpers */
  const moneyLabel = (
    <Text style={styles.money}>Tu saldo: €{me.money}</Text>
  );

  /* JSX */
  return (
    <View style={styles.container}>
      <AuctionHeader artwork={auction.artwork} artist={auction.artist} typeName={auction.type} />

      <AuctionTimer duration={10} timeLeft={timer} />

      {/* orden de turnos */}
      <View style={styles.orderRow}>
        {players.map((p, i) => (
          <Text key={p.uid} style={p.uid === auction.sellerId && styles.seller}>
            {i + 1}. {p.name}
          </Text>
        ))}
      </View>

      <AuctionStateInfo
        auctionType={auction.type}
        highestBid={auction.highestBid}
        highestBidder={auction.highestBidder ?? undefined}
        bidsReceived={Object.keys(auction.bids).length}
        totalPlayers={players.length}
        fixedPrice={auction.type === 'fixed' ? auction.fixedPrice : undefined}
      />

      <BidList
        bids={auction.bids}
        visible={['open', 'double'].includes(auction.type)}
        getPlayerName={uid => players.find(p => p.uid === uid)?.name ?? 'Nadie'}
      />

      {/* vendedor fija precio */}
      {canSetPrice && (
        <View style={styles.priceRow}>
          <TextInput
            style={styles.input}
            placeholder={`${auction.fixedPrice || ''}`}
            keyboardType="number-pad"
            value={priceInput}
            onChangeText={setPriceInput}
          />
          <Button title="Fijar" onPress={setFixedPrice} />
        </View>
      )}

      {/* comprador */}
      {!isSeller && !canSetPrice && (
        auction.type === 'fixed' ? (
          <>
            {moneyLabel}
            <Button
              title={`Comprar (€${auction.fixedPrice})`}
              onPress={() => placeBid(auction.fixedPrice)}
              disabled={alreadyBid || auction.fixedPrice > me.money}
            />
          </>
        ) : (
          <>
            {moneyLabel}
            <BidInput
              type={auction.type}
              fixedPrice={auction.fixedPrice}
              currentMoney={me.money}
              disabled={alreadyBid}
              onSubmit={placeBid}
            />
          </>
        )
      )}

      {/* acciones vendedor */}
      {isSeller && !canSetPrice && (
        <SellerActions
          type={auction.type}
          onFinish={() => finishAuction()}
          onCancel={cancelAuction}
          onReveal={() => finishAuction()}
        />
      )}

      <TieBreakModal
        visible={false}           /* TODO: implementar modal de empate */
        tiedBidders={[]}
        bids={auction.bids}
        getPlayerName={uid => players.find(p => p.uid === uid)?.name ?? 'Nadie'}
        onResolve={id => finishAuction(id)}
      />
    </View>
  );
}

/* ─────────── estilos ─────────── */
const styles = StyleSheet.create({
  container:{ flex:1, padding:16, backgroundColor:'#f5f5f5' },
  c:{ flex:1, justifyContent:'center', alignItems:'center' },
  orderRow:{ flexDirection:'row', flexWrap:'wrap', gap:6, marginVertical:6 },
  seller:{ fontWeight:'700', textDecorationLine:'underline' },
  money:{ textAlign:'center', marginBottom:4, fontWeight:'600' },
  priceRow:{ flexDirection:'row', alignItems:'center', gap:8, marginVertical:6 },
  input:{ borderWidth:1, borderColor:'#999', borderRadius:4, padding:4, width:80 },
  sentMsg:{ textAlign:'center', marginVertical:6, color:'#4CAF50', fontWeight:'600' },
});
