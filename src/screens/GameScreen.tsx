// src/screens/GameScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Button,
  FlatList,
  Alert,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ViewStyle,
  StyleProp,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import {
  useRoute,
  useNavigation,
  RouteProp,
} from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { checkAndAdvanceRound } from '../utils/roundManager';
import type {
  NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

// --- Types ---
type GameScreenRouteProp = RouteProp<RootStackParamList, 'Game'>;
type GameScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Game'>;

type AuctionType = 'open' | 'sealed' | 'once' | 'fixed' | 'double';

interface CardType {
  id: string;
  title: string;
  artist: string;
  auctionType: AuctionType;
  value: number;
}

interface Player {
  uid: string;
  name: string;
  hand: CardType[];
  money: number;
  collection?: { title: string; artist: string }[];
}

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
}

interface GameData {
  status?: 'waiting' | 'inProgress' | 'finished';
  round: number;
  players: Player[];
  currentTurn: string;
  currentAuction?: Auction;
  artistCounts?: Record<string, number>;
}

export default function GameScreen() {
  const route = useRoute<GameScreenRouteProp>();
  const navigation = useNavigation<GameScreenNavigationProp>();
  const { user } = useAuth();
  const { gameId } = route.params;

  const [game, setGame] = useState<GameData | null>(null);
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
  const [secondCard, setSecondCard] = useState<CardType | null>(null);
  const [bidInput, setBidInput] = useState('');

  if (!user) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  const uid = user.uid;

  // Subscribe to game updates
  useEffect(() => {
    const gameRef = firestore().doc(`games/${gameId}`);
    const unsubscribe = gameRef.onSnapshot(doc => {
      const data = doc.data() as GameData | undefined;
      if (data) {
        setGame(data);
        if (data.status === 'finished') {
          navigation.replace('EndGame', { gameId });
        }
      }
    });
    return () => unsubscribe();
  }, [gameId, navigation]);

  if (!game) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const player = game.players.find(p => p.uid === uid)!;
  const isMyTurn = uid === game.currentTurn;
  const auction = game.currentAuction;

  // Start auction
  const startAuction = async () => {
    if (!selectedCard) return;
    const cards = [selectedCard];
    let type = selectedCard.auctionType;
    if (type === 'double') {
      if (!secondCard || secondCard.artist !== selectedCard.artist) {
        Alert.alert('Selecciona una segunda carta del mismo artista');
        return;
      }
      cards.push(secondCard);
      type = secondCard.auctionType;
    }
    const newHand = player.hand.filter(c => !cards.some(sc => sc.id === c.id));
    const updatedPlayers = game.players.map(p =>
      p.uid === uid ? { ...p, hand: newHand } : p
    );
    const newAuction: Auction = {
      artwork: cards.map(c => c.title).join(' + '),
      artist: selectedCard.artist,
      type,
      sellerId: uid,
      bids: {},
      highestBid: 0,
      highestBidder: null,
      turnIndex: 0,
      fixedPrice: 200,
    };
    await firestore().doc(`games/${gameId}`).update({
      players: updatedPlayers,
      currentAuction: newAuction,
    });
    setSelectedCard(null);
    setSecondCard(null);
  };

  // Submit bid
  const submitBid = async () => {
    if (!auction) return;
    const amount = parseInt(bidInput, 10);
    if (isNaN(amount) || amount > player.money) return;
    if (uid === auction.sellerId) {
      Alert.alert('El vendedor no puede pujar');
      return;
    }
    const update: Partial<Auction> = {};
    update.highestBid = amount;
    update.highestBidder = uid;
    const merged = { ...auction, ...update };
    await firestore().doc(`games/${gameId}`).update({ currentAuction: merged });
    setBidInput('');
  };

  // Cancel auction
  const cancelAuction = async () => {
    await firestore().doc(`games/${gameId}`).update({ currentAuction: firestore.FieldValue.delete() });
  };

  // Finish auction and rotate turn
  const finishAuction = async () => {
    if (!auction) return;
    let winner = auction.highestBidder;
    let max = auction.highestBid;
    // For sealed and once auctions, determine winner
    if (auction.type !== 'open') {
      for (const [bidder, val] of Object.entries(auction.bids)) {
        if (val > max) {
          max = val;
          winner = bidder;
        }
      }
    }
    if (!winner) {
      await cancelAuction();
      return;
    }
    // Update players' collections and balances
    const wonItems = auction.artwork.split(' + ').map(title => ({ title, artist: auction.artist }));
    const updatedPlayers = game.players.map(p => {
      if (p.uid === winner) return { ...p, money: p.money - max, collection: [...(p.collection || []), ...wonItems] };
      if (p.uid === auction.sellerId) return { ...p, money: p.money + max };
      return p;
    });
    const nextIndex = (game.players.findIndex(p => p.uid === auction.sellerId) + 1) % game.players.length;
    const nextTurn = game.players[nextIndex].uid;
    const newCounts = { ...(game.artistCounts || {}), [auction.artist]: (game.artistCounts?.[auction.artist] || 0) + 1 };
    await firestore().doc(`games/${gameId}`).update({
      players: updatedPlayers,
      currentAuction: firestore.FieldValue.delete(),
      currentTurn: nextTurn,
      artistCounts: newCounts,
    });
    await checkAndAdvanceRound(gameId);
  };

  // Render player's hand card
  const renderCard = ({ item }: { item: CardType }) => {
    const cardStyles: StyleProp<ViewStyle>[] = [styles.card];
    if (selectedCard?.id === item.id || secondCard?.id === item.id) cardStyles.push(styles.selectedCard);
    return (
      <TouchableOpacity onPress={() => (selectedCard ? setSecondCard(item) : setSelectedCard(item))} style={cardStyles as StyleProp<ViewStyle>}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardArtist}>{item.artist}</Text>
        <Text style={styles.cardType}>{item.auctionType}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ronda {game.round} – Turno de: {game.players.find(p => p.uid === game.currentTurn)?.name}</Text>

      {auction ? (
        <View style={styles.auctionContainer}>
          <Text style={styles.subtitle}>Obra: {auction.artwork}</Text>
          <Text style={styles.subtitle}>Última puja: ${auction.highestBid} por {game.players.find(p => p.uid === auction.highestBidder)?.name}</Text>
          <TextInput
            placeholder="Ingresa tu oferta"
            value={bidInput}
            onChangeText={setBidInput}
            keyboardType="numeric"
            style={styles.input}
          />
          <Button title="Ofertar" onPress={submitBid} />
          {uid === auction.sellerId && (
            <View style={styles.sellerActions}>
              <Button title="Finalizar" onPress={finishAuction} />
              <Button title="Cancelar" color="#B00020" onPress={cancelAuction} />
            </View>
          )}
        </View>
      ) : (
        <View style={styles.handContainer}>
          <Text style={styles.subtitle}>Tu mano</Text>
          <FlatList<CardType>
            data={player.hand}
            renderItem={renderCard}
            keyExtractor={item => item.id}
            horizontal
            contentContainerStyle={styles.handList}
          />
          {isMyTurn && <Button title="Iniciar subasta" onPress={startAuction} disabled={!selectedCard || (selectedCard.auctionType === 'double' && !secondCard)} />}
        </View>
      )}

      <Text style={styles.subtitle}>Saldo: ${player.money}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { fontSize: 16, marginVertical: 8 },
  input: { borderWidth: 1, borderColor: '#999', padding: 8, borderRadius: 5, marginVertical: 10 },
  auctionContainer: { padding: 16, backgroundColor: '#fff', borderRadius: 8, marginVertical: 10 },
  sellerActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  handContainer: { marginVertical: 10 },
  handList: { paddingVertical: 8 },
  card: { padding: 10, margin: 6, borderWidth: 1, borderColor: '#aaa', borderRadius: 6, backgroundColor: '#f9f9f9', minWidth: 100, alignItems: 'center' },
  selectedCard: { borderColor: '#4CAF50', borderWidth: 2 },
  cardTitle: { fontWeight: 'bold' },
  cardArtist: { fontSize: 12, color: '#555' },
  cardType: { fontSize: 10, color: '#888' },
});
