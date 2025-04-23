// src/screens/GameScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Button, FlatList,
  Alert, ActivityIndicator, ViewStyle, StyleProp, TouchableOpacity
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import AuctionScreen from './AuctionScreen';
import { RootStackParamList } from '../navigation/types';

// Tipos mínimos
type AuctionType = 'open' | 'sealed' | 'once' | 'fixed' | 'double';
interface CardType { id: string; title: string; artist: string; auctionType: AuctionType; }
interface Player { uid: string; name: string; hand: CardType[]; money: number; collection?: any[]; }
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
}
interface GameData {
  round: number;
  players: Player[];
  currentTurn: string;
  currentAuction?: Auction;
  currentTurnIndex?: number;
}

type GameScreenRouteProp = RouteProp<RootStackParamList, 'Game'>;
type GameScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Game'>;

export default function GameScreen() {
  const { user } = useAuth();
  const route = useRoute<GameScreenRouteProp>();
  const navigation = useNavigation<GameScreenNavigationProp>();
  const { gameId } = route.params;

  const [game, setGame] = useState<GameData | null>(null);
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
  const [secondCard, setSecondCard] = useState<CardType | null>(null);

  if (!user) return (
    <View style={styles.centered}><ActivityIndicator size="large"/></View>
  );
  const uid = user.uid;

  useEffect(() => {
    const gameRef = firestore().doc(`games/${gameId}`);
    const unsubscribe = gameRef.onSnapshot(doc => {
      const data = doc.data() as GameData | undefined;
      if (data) {
        setGame(data);
      }
    });
    return () => unsubscribe();
  }, [gameId]);

  if (!game) return (
    <View style={styles.centered}><ActivityIndicator size="large"/></View>
  );

  // Si hay una subasta activa, delegamos a AuctionScreen
  if (game.currentAuction) {
    return <AuctionScreen gameId={gameId} userId={uid} />;
  }

  // Datos del jugador
  const player = game.players.find(p => p.uid === uid)!;
  const isMyTurn = uid === game.currentTurn;

  // Función para iniciar subasta
  const startAuction = async () => {
    if (!selectedCard) {
      Alert.alert('Selecciona una carta');
      return;
    }
    const cards = [selectedCard];
    if (selectedCard.auctionType === 'double') {
      if (!secondCard || secondCard.artist !== selectedCard.artist) {
        Alert.alert('Selecciona segunda carta del mismo artista');
        return;
      }
      cards.push(secondCard);
    }

    // Actualizar mano localmente y en Firestore
    const newHand = player.hand.filter(c => !cards.find(sc => sc.id === c.id));
    const updatedPlayers = game.players.map(p =>
      p.uid === uid ? { ...p, hand: newHand } : p
    );

    // Crear objeto de subasta
    const newAuction: Auction = {
      artwork: cards.map(c => c.title).join(' + '),
      artist: selectedCard.artist,
      type: selectedCard.auctionType,
      sellerId: uid,
      bids: {},
      highestBid: 0,
      highestBidder: null,
      turnIndex: game.currentTurnIndex ?? 0,
      fixedPrice: 200,
      cardCount: cards.length,
    };

    await firestore().doc(`games/${gameId}`).update({
      players: updatedPlayers,
      currentAuction: newAuction,
    });
    setSelectedCard(null);
    setSecondCard(null);
  };

  // Render de cada carta
  const renderCard = ({ item }: { item: CardType }) => {
    const stylesArr: StyleProp<ViewStyle>[] = [styles.card];
    if (selectedCard?.id === item.id) stylesArr.push(styles.selectedCard);
    if (secondCard?.id === item.id) stylesArr.push(styles.secondSelectedCard);
    return (
      <TouchableOpacity
        style={stylesArr as StyleProp<ViewStyle>}
        onPress={() => {
          if (!selectedCard) setSelectedCard(item);
          else if (
            selectedCard.auctionType === 'double' &&
            selectedCard.id !== item.id &&
            item.artist === selectedCard.artist &&
            !secondCard
          ) {
            setSecondCard(item);
          } else {
            setSelectedCard(item); setSecondCard(null);
          }
        }}
        disabled={!isMyTurn}
      >
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardArtist}>{item.artist}</Text>
        <Text style={styles.cardType}>{item.auctionType}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Ronda {game.round} – Turno de: {game.players.find(p => p.uid === game.currentTurn)?.name}
      </Text>

      <View style={styles.handContainer}>
        <Text style={styles.subtitle}>Tu mano ({player.hand.length} cartas)</Text>
        <FlatList
          data={player.hand}
          renderItem={renderCard}
          keyExtractor={item => item.id}
          horizontal
          contentContainerStyle={styles.handList}
        />
        {isMyTurn && (
          <Button
            title="Iniciar subasta"
            onPress={startAuction}
            disabled={
              !selectedCard ||
              (selectedCard?.auctionType === 'double' && !secondCard)
            }
          />
        )}
      </View>

      <View style={styles.playerInfo}>
        <Text style={styles.subtitle}>Saldo: ${player.money}</Text>
        {player.collection && (
          <Text style={styles.collectionInfo}>
            Colección: {player.collection.length} obras
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  handContainer: { marginVertical: 10, backgroundColor: '#fff', padding: 16, borderRadius: 8, elevation: 2 },
  handList: { paddingVertical: 8 },
  card: { padding: 10, margin: 6, borderWidth: 1, borderColor: '#aaa', borderRadius: 6, backgroundColor: '#f9f9f9', minWidth: 100, alignItems: 'center' },
  selectedCard: { borderColor: '#4CAF50', borderWidth: 2, backgroundColor: '#e8f5e9' },
  secondSelectedCard: { borderColor: '#2196F3', borderWidth: 2, backgroundColor: '#e3f2fd' },
  cardTitle: { fontWeight: 'bold' },
  cardArtist: { fontSize: 12, color: '#555' },
  cardType: { fontSize: 10, color: '#888', marginTop: 4 },
  subtitle: { fontSize: 16, marginVertical: 8, fontWeight: '600' },
  playerInfo: { marginTop: 'auto', padding: 10, backgroundColor: '#fff', borderRadius: 8, elevation: 2 },
  collectionInfo: { fontSize: 14, color: '#555' }
});
