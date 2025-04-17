// src/screens/GameScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Button, Alert, FlatList, TouchableOpacity } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { checkAndAdvanceRound } from '../utils/roundManager';

type RootStackParamList = {
  Game: { gameId: string };
};

type GameRouteProp = RouteProp<RootStackParamList, 'Game'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type Card = {
  id: string;
  title: string;
  artist: string;
  auctionType: 'open' | 'sealed' | 'once' | 'double';
};

export default function GameScreen() {
  const { user } = useAuth();
  const route = useRoute<GameRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { gameId } = route.params;

  const [game, setGame] = useState<any>(null);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [selectedSecondCard, setSelectedSecondCard] = useState<Card | null>(null);
  const [isDoubleMode, setIsDoubleMode] = useState(false);

  useEffect(() => {
    const unsubscribe = firestore()
      .collection('games')
      .doc(gameId)
      .onSnapshot((doc) => {
        const data = doc.data();
        if (!data) return;
        setGame(data);
      });

    return () => unsubscribe();
  }, [gameId]);

  if (!game || !user) return null;

  const isMyTurn = user.uid === game.currentTurn;
  const player = game.players?.find((p: any) => p.uid === user.uid);
  const activePlayer = game.players?.find((p: any) => p.uid === game.currentTurn);

  const handleStartAuction = async () => {
    if (!selectedCard) {
      Alert.alert('Seleccioná una carta para subastar');
      return;
    }

    // Subasta doble: requiere segunda carta
    if (selectedCard.auctionType === 'double') {
      setIsDoubleMode(true);
      return;
    }

    await launchAuction([selectedCard], selectedCard.auctionType);
  };

  const confirmDoubleAuction = async () => {
    if (!selectedSecondCard) {
      Alert.alert('Seleccioná una segunda carta del mismo artista');
      return;
    }

    if (selectedCard?.artist !== selectedSecondCard.artist) {
      Alert.alert('Ambas cartas deben ser del mismo artista');
      return;
    }

    await launchAuction([selectedCard, selectedSecondCard], selectedSecondCard.auctionType);
  };

  const launchAuction = async (cards: Card[], type: string) => {
    const artworkTitles = cards.map((c) => c.title).join(' + ');
    const artist = cards[0].artist;

    const updatedHand = player.hand.filter(
      (c: Card) => !cards.find((sel) => sel.id === c.id)
    );
    const updatedPlayers = game.players.map((p: any) =>
      p.uid === user.uid ? { ...p, hand: updatedHand } : p
    );

    const auctionData = {
      artwork: artworkTitles,
      artist,
      type,
      sellerId: user.uid,
      highestBid: 0,
      highestBidder: null,
    };

    await firestore().collection('games').doc(gameId).update({
      currentAuction: auctionData,
      players: updatedPlayers,
    });

    setSelectedCard(null);
    setSelectedSecondCard(null);
    setIsDoubleMode(false);
  };

  const handleBid = async (amount: number) => {
    if (amount > player.money) {
      Alert.alert('No tenés suficiente dinero');
      return;
    }

    await firestore().collection('games').doc(gameId).update({
      'currentAuction.highestBid': amount,
      'currentAuction.highestBidder': user.uid,
    });
  };

  const handlePass = async () => {
    Alert.alert('Pasaste tu turno');
    await advanceTurn();
  };

  const advanceTurn = async () => {
    const currentIndex = game.players.findIndex((p: any) => p.uid === game.currentTurn);
    const nextIndex = (currentIndex + 1) % game.players.length;
    const nextTurn = game.players[nextIndex].uid;

    await firestore().collection('games').doc(gameId).update({
      currentTurn: nextTurn,
    });
  };

  const handleFinishAuction = async () => {
    const { highestBid, highestBidder, sellerId, artist } = game.currentAuction;

    if (!highestBidder) {
      await firestore().collection('games').doc(gameId).update({
        currentAuction: firestore.FieldValue.delete(),
      });
      return;
    }

    const updatedPlayers = game.players.map((p: any) => {
      if (p.uid === highestBidder) return { ...p, money: p.money - highestBid };
      if (p.uid === sellerId) return { ...p, money: p.money + highestBid };
      return p;
    });

    const newArtistCounts = { ...(game.artistCounts || {}) };
    newArtistCounts[artist] = (newArtistCounts[artist] || 0) + 1;

    await firestore().collection('games').doc(gameId).update({
      players: updatedPlayers,
      currentAuction: firestore.FieldValue.delete(),
      currentTurn: sellerId,
      artistCounts: newArtistCounts,
    });

    await checkAndAdvanceRound(gameId);
  };

  const renderCard = ({ item }: { item: Card }) => {
    const isSelected =
      item.id === selectedCard?.id || item.id === selectedSecondCard?.id;
    const canSelectSecond =
      isDoubleMode && selectedCard && item.artist === selectedCard.artist && item.id !== selectedCard.id;

    return (
      <TouchableOpacity
        style={[styles.card, isSelected && styles.selectedCard]}
        onPress={() => {
          if (!selectedCard) {
            setSelectedCard(item);
          } else if (canSelectSecond) {
            setSelectedSecondCard(item);
          }
        }}
      >
        <Text style={styles.cardText}>{item.title}</Text>
        <Text style={styles.cardTextSmall}>🎨 {item.artist}</Text>
        <Text style={styles.cardTextSmall}>🧾 {item.auctionType}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Turno de: {activePlayer?.name}</Text>

      {game.currentAuction ? (
        <>
          <Text style={styles.subtitle}>Subasta: {game.currentAuction.artwork}</Text>
          <Text>Artista: {game.currentAuction.artist}</Text>
          <Text>Tipo: {game.currentAuction.type}</Text>
          <Text>Oferta actual: ${game.currentAuction.highestBid}</Text>

          {isMyTurn && (
            <>
              <Button title="Pujar $100" onPress={() => handleBid(100)} />
              <Button title="Pujar $200" onPress={() => handleBid(200)} />
              <Button title="Pasar" onPress={handlePass} />
            </>
          )}

          {user.uid === game.currentAuction.sellerId && (
            <Button title="Finalizar subasta" onPress={handleFinishAuction} />
          )}
        </>
      ) : isMyTurn ? (
        <>
          <Text style={styles.subtitle}>
            {isDoubleMode
              ? 'Seleccioná la segunda carta del mismo artista'
              : 'Seleccioná una carta para iniciar la subasta'}
          </Text>
          <FlatList
            data={player.hand}
            keyExtractor={(item) => item.id}
            renderItem={renderCard}
            horizontal
          />
          {!isDoubleMode ? (
            <Button title="Iniciar subasta" onPress={handleStartAuction} />
          ) : (
            <Button title="Confirmar subasta doble" onPress={confirmDoubleAuction} />
          )}
        </>
      ) : (
        <Text>Esperando que {activePlayer?.name} inicie una subasta...</Text>
      )}

      <View style={styles.separator} />
      <Text>Tu saldo: ${player.money}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { fontSize: 18, fontWeight: '600', marginVertical: 10 },
  separator: { height: 1, backgroundColor: '#ccc', marginVertical: 20 },
  card: {
    borderWidth: 1,
    borderColor: '#aaa',
    padding: 10,
    margin: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  selectedCard: {
    borderColor: '#007bff',
    backgroundColor: '#e6f0ff',
  },
  cardText: { fontWeight: 'bold', fontSize: 16 },
  cardTextSmall: { fontSize: 12 },
});
