// src/screens/GameScreen.tsx - con lógica completa de subasta según tipo de carta
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import type { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';

// Tipos de subasta
const AUCTION_TYPES = ['open', 'sealed', 'once', 'double'] as const;
type AuctionType = typeof AUCTION_TYPES[number];

type Card = {
  id: number;
  artist: string;
  auctionType: AuctionType;
};

type GameRouteProp = RouteProp<RootStackParamList, 'Game'>;

export default function GameScreen() {
  const { user } = useAuth();
  const route = useRoute<GameRouteProp>();
  const { gameId } = route.params;

  const [game, setGame] = useState<any>(null);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  useEffect(() => {
    const unsubscribe = firestore()
      .collection('games')
      .doc(gameId)
      .onSnapshot((doc) => {
        const data = doc.data();
        if (data) setGame(data);
      });

    return () => unsubscribe();
  }, [gameId]);

  if (!game || !user) return null;

  const player = game.players.find((p: any) => p.uid === user.uid);
  const hand: Card[] = player?.hand ?? [];
  const currentTurn = game.currentTurn;
  const isMyTurn = user.uid === currentTurn;

  const handleAuction = async () => {
    if (!selectedCard) {
      Alert.alert('Seleccioná una carta para subastar');
      return;
    }

    if (!isMyTurn) {
      Alert.alert('No es tu turno');
      return;
    }

    try {
      await firestore().collection('games').doc(gameId).update({
        currentAuction: {
          card: selectedCard,
          auctionType: selectedCard.auctionType,
          artist: selectedCard.artist,
          seller: user.uid,
          bids: [],
          status: 'active',
        },
      });

      // Eliminar la carta de la mano del jugador
      const updatedPlayers = game.players.map((p: any) => {
        if (p.uid === user.uid) {
          return {
            ...p,
            hand: p.hand.filter((c: Card) => c.id !== selectedCard.id),
          };
        }
        return p;
      });

      await firestore().collection('games').doc(gameId).update({ players: updatedPlayers });
      Alert.alert(`Subasta iniciada (${selectedCard.auctionType})`);
      setSelectedCard(null);
    } catch (error) {
      console.error('Error iniciando subasta', error);
      Alert.alert('Error al iniciar subasta');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tu mano:</Text>

      <FlatList
        horizontal
        data={hand}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setSelectedCard(item)}
            style={[styles.card, selectedCard?.id === item.id && styles.selectedCard]}
          >
            <Text style={styles.cardText}>{item.artist}</Text>
            <Text style={styles.cardType}>{item.auctionType}</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.cardList}
        showsHorizontalScrollIndicator={false}
      />

      <TouchableOpacity style={styles.auctionButton} onPress={handleAuction}>
        <Text style={styles.auctionText}>Iniciar Subasta</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  cardList: { paddingVertical: 10 },
  card: {
    backgroundColor: '#f5f5f5',
    padding: 20,
    borderRadius: 10,
    marginRight: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    width: 120,
    justifyContent: 'center',
  },
  selectedCard: {
    borderColor: 'blue',
    borderWidth: 2,
    backgroundColor: '#e0f7fa',
  },
  cardText: { fontSize: 16, marginBottom: 5 },
  cardType: { fontSize: 14, color: '#666' },
  auctionButton: {
    marginTop: 20,
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  auctionText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
