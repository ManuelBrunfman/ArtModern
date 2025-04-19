// -----------------------------------------------------------------------------
// src/screens/GameScreen.tsx  (versión completa v2)
// -----------------------------------------------------------------------------
import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  Button,
  Alert,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import type { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';

/* -------------------------------------------------------------------------- */
/* 1. Tipos                                                                  */
/* -------------------------------------------------------------------------- */
export type AuctionType = 'open' | 'sealed' | 'once' | 'double';

export type Card = {
  id: number;
  artist: string;
  auctionType: AuctionType;
};

export type Player = {
  uid: string;
  name: string;
  money: number;
  hand: Card[];
  collection: Card[];
  isHost: boolean;
};

export type Bid = {
  uid: string;
  name: string;
  amount: number;
};

/* -------------------------------------------------------------------------- */
/* 2. Utilidades                                                              */
/* -------------------------------------------------------------------------- */
const getNextPlayerUid = (players: Player[], currentUid: string): string => {
  const idx = players.findIndex((p) => p.uid === currentUid);
  const nextIdx = (idx + 1) % players.length;
  return players[nextIdx].uid;
};

/* -------------------------------------------------------------------------- */
/* 3. Componente                                                              */
/* -------------------------------------------------------------------------- */
const GameScreen = () => {
  const { user } = useAuth();
  const route = useRoute<RouteProp<RootStackParamList, 'Game'>>();
  const { gameId } = route.params;

  const [game, setGame] = useState<any | null>(null);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [bidAmount, setBidAmount] = useState<string>('');

  /* ---------------------------------------------------------------------- */
  /* Suscripción a la partida                                                */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    const unsub = firestore()
      .collection('games')
      .doc(gameId)
      .onSnapshot((doc) => setGame(doc.data()));
    return () => unsub();
  }, [gameId]);

  /* ---------------------------------------------------------------------- */
  /* Memo helpers                                                            */
  /* ---------------------------------------------------------------------- */
  const isMyTurn = useMemo(() => game?.currentTurn === user?.uid, [game, user]);
  const currentPlayer: Player | undefined = useMemo(
    () => game?.players?.find((p: Player) => p.uid === user?.uid),
    [game, user]
  );
  const hand: Card[] = currentPlayer?.hand ?? [];

  if (!game || !user || !currentPlayer) return null;

  /* ---------------------------------------------------------------------- */
  /* 4. Iniciar subasta                                                      */
  /* ---------------------------------------------------------------------- */
  const startAuction = async () => {
    try {
      if (!isMyTurn) {
        Alert.alert('Espera tu turno');
        return;
      }
      if (game.currentAuction) {
        Alert.alert('Ya hay una subasta en curso');
        return;
      }
      if (!selectedCard) {
        Alert.alert('Selecciona una carta');
        return;
      }

      // Remover carta de la mano del jugador
      const updatedPlayers: Player[] = game.players.map((p: Player) =>
        p.uid === user.uid ? { ...p, hand: p.hand.filter((c) => c.id !== selectedCard.id) } : p
      );

      await firestore().collection('games').doc(gameId).update({
        players: updatedPlayers,
        currentAuction: {
          card: selectedCard,
          seller: user.uid,
          auctionType: selectedCard.auctionType,
          bids: [] as Bid[],
          highestBid: null,
          highestBidder: null,
        },
      });
      setSelectedCard(null);
    } catch (err) {
      console.error(err);
      Alert.alert('Error al iniciar la subasta');
    }
  };

  /* ---------------------------------------------------------------------- */
  /* 5. Ofertar                                                              */
  /* ---------------------------------------------------------------------- */
  const placeBid = async () => {
    try {
      if (!game.currentAuction) return;
      if (game.currentAuction.seller === user.uid) return; // el vendedor no oferta
      const amount = parseInt(bidAmount, 10);
      if (isNaN(amount) || amount <= 0) {
        Alert.alert('Ingresa una oferta válida');
        return;
      }
      if (amount > currentPlayer.money) {
        Alert.alert('No tienes suficiente dinero');
        return;
      }
      const highest = game.currentAuction.highestBid ?? 0;
      if (amount <= highest) {
        Alert.alert('Debe superar la oferta más alta');
        return;
      }

      await firestore().collection('games').doc(gameId).update({
        'currentAuction.highestBid': amount,
        'currentAuction.highestBidder': user.uid,
        'currentAuction.bids': firestore.FieldValue.arrayUnion({
          uid: user.uid,
          name: currentPlayer.name,
          amount,
        }),
      });
      setBidAmount('');
    } catch (e) {
      console.error(e);
      Alert.alert('Error al ofertar');
    }
  };

  /* ---------------------------------------------------------------------- */
  /* 6. Finalizar subasta (solo vendedor)                                    */
  /* ---------------------------------------------------------------------- */
  const finishAuction = async () => {
    try {
      const auction = game.currentAuction;
      if (!auction) return;
      if (auction.seller !== user.uid) return;

      const { highestBid, highestBidder, card } = auction;
      let updatedPlayers: Player[] = [...game.players];

      if (highestBidder) {
        updatedPlayers = updatedPlayers.map((p) => {
          if (p.uid === highestBidder) {
            return {
              ...p,
              money: p.money - highestBid,
              collection: [...(p.collection || []), card],
            } as Player;
          }
          if (p.uid === user.uid) {
            return { ...p, money: p.money + highestBid } as Player;
          }
          return p;
        });
      } else {
        // Sin ofertas: el vendedor se queda con la carta (opción reglamento)
        updatedPlayers = updatedPlayers.map((p) =>
          p.uid === user.uid ? { ...p, collection: [...(p.collection || []), card] } : p
        );
      }

      const nextTurn = getNextPlayerUid(updatedPlayers, user.uid);

      await firestore().collection('games').doc(gameId).update({
        players: updatedPlayers,
        currentAuction: null,
        currentTurn: nextTurn,
      });
    } catch (e) {
      console.error(e);
      Alert.alert('Error al finalizar la subasta');
    }
  };

  /* ---------------------------------------------------------------------- */
  /* 7. UI                                                                   */
  /* ---------------------------------------------------------------------- */
  return (
    <View style={styles.container}>
      {/* Información de jugador */}
      <Text style={styles.money}>Dinero: ${currentPlayer.money}</Text>

      {/* Mano */}
      <Text style={styles.title}>Tu mano ({hand.length})</Text>
      <FlatList
        data={hand}
        keyExtractor={(item) => item.id.toString()}
        horizontal
        contentContainerStyle={styles.cardsRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, selectedCard?.id === item.id && styles.selected]}
            onPress={() => setSelectedCard(item)}
          >
            <Text style={styles.cardArtist}>{item.artist}</Text>
            <Text style={styles.cardType}>{item.auctionType}</Text>
          </TouchableOpacity>
        )}
      />

      {/* Botón para iniciar subasta */}
      {isMyTurn && (
        <Button
          title="Iniciar Subasta"
          onPress={startAuction}
          disabled={!selectedCard || !!game.currentAuction}
        />
      )}

      {/* Bloque de subasta en curso */}
      {game.currentAuction && (
        <View style={styles.auctionBox}>
          <Text style={styles.subtitle}>🔨 Subasta en curso</Text>
          <Text>Artista: {game.currentAuction.card.artist}</Text>
          <Text>Tipo: {game.currentAuction.auctionType}</Text>
          <Text>
            Vendedor:{' '}
            {game.currentAuction.seller === user.uid ? 'Tú' : game.currentAuction.seller}
          </Text>
          <Text>Oferta más alta: {game.currentAuction.highestBid ?? '—'}</Text>

          {/* Ofertar */}
          {game.currentAuction.seller !== user.uid && (
            <View style={styles.bidRow}>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="Tu oferta"
                value={bidAmount}
                onChangeText={setBidAmount}
              />
              <Button title="Ofertar" onPress={placeBid} />
            </View>
          )}

          {/* Finalizar (solo vendedor) */}
          {game.currentAuction.seller === user.uid && (
            <Button
              title="Finalizar Subasta"
              onPress={finishAuction}
              disabled={!game.currentAuction.highestBidder && !game.currentAuction.highestBid}
            />
          )}
        </View>
      )}
    </View>
  );
};

export default GameScreen;

/* -------------------------------------------------------------------------- */
/* 8. Estilos                                                                */
/* -------------------------------------------------------------------------- */
const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  money: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  cardsRow: { gap: 8, paddingBottom: 16 },
  card: {
    backgroundColor: '#f2f2f2',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    minWidth: 90,
    alignItems: 'center',
  },
  selected: { borderColor: 'dodgerblue', borderWidth: 2 },
  cardArtist: { fontSize: 14, fontWeight: '700' },
  cardType: { fontSize: 12, color: '#555' },
  auctionBox: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#ffefd5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f0c87a',
  },
  bidRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    borderRadius: 6,
  },
});
