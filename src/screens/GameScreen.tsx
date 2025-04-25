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
  TouchableOpacity
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { checkAndAdvanceRound } from '../utils/roundManager';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Game'>;

export default function GameScreen() {
  const { user } = useAuth();
  const route = useRoute();
  const navigation = useNavigation<NavigationProp>();
  const { gameId } = route.params as { gameId: string };

  const [game, setGame] = useState<any>(null);
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [secondCard, setSecondCard] = useState<any>(null);
  const [bidInput, setBidInput] = useState('');
  const [hasBid, setHasBid] = useState(false);
  const [fixedPriceInput, setFixedPriceInput] = useState('');

  useEffect(() => {
    const unsub = firestore()
      .collection('games')
      .doc(gameId)
      .onSnapshot((doc) => {
        const data = doc.data();
        if (!data) return;
        setGame(data);
        if (data.status === 'finished') {
          navigation.navigate('EndGame', { gameId });
        }
      });
    return () => unsub();
  }, [gameId, navigation]);

  if (!game || !user) return null;

  // Aseguramos arrays definidos
  const players = Array.isArray(game.players) ? game.players : [];
  const player = players.find((p: any) => p.uid === user.uid);
  if (!player) return <Text>Jugador no encontrado</Text>;

  const hand = Array.isArray(player.hand) ? player.hand : [];
  const collection = Array.isArray(player.collection) ? player.collection : [];

  const isMyTurn = user.uid === game.currentTurn;
  const isSeller = user.uid === game.currentAuction?.sellerId;
  const getPlayerName = (uid: string) =>
    players.find((p: any) => p.uid === uid)?.name || 'Jugador';

  // Iniciar subasta
  const handleStartAuction = async () => {
    if (!selectedCard) return;

    const auctionCards = [selectedCard];
    let auctionType = selectedCard.auctionType;

    if (selectedCard.auctionType === 'double') {
      if (!secondCard || secondCard.artist !== selectedCard.artist) {
        Alert.alert('Seleccioná una segunda carta del mismo artista');
        return;
      }
      auctionCards.push(secondCard);
      auctionType = secondCard.auctionType;
    }

    const updatedHand = hand.filter(
      (c: any) => !auctionCards.find((sel) => sel.id === c.id)
    );

    const updatedPlayers = players.map((p: any) =>
      p.uid === user.uid ? { ...p, hand: updatedHand } : p
    );

    const auction = {
      artwork: auctionCards.map((c) => c.title).join(' + '),
      artist: selectedCard.artist,
      type: auctionType,
      sellerId: user.uid,
      bids: {},
      highestBid: 0,
      highestBidder: null,
      turnIndex: 0,
      fixedPrice: auctionType === 'fixed' ? parseInt(fixedPriceInput) || 200 : 200,
    };

    await firestore().collection('games').doc(gameId).update({
      currentAuction: auction,
      players: updatedPlayers,
    });

    setSelectedCard(null);
    setSecondCard(null);
    setFixedPriceInput('');
    setHasBid(false);
  };

  // Enviar puja
  const submitBid = async () => {
    const amount = parseInt(bidInput);
    if (!amount || amount > player.money || isSeller) return;

    const update: any = {};
    if (game.currentAuction.type === 'open') {
      if (amount <= game.currentAuction.highestBid) return;
      update['currentAuction.highestBid'] = amount;
      update['currentAuction.highestBidder'] = user.uid;
    } else {
      update['currentAuction.bids'] = {
        ...game.currentAuction.bids,
        [user.uid]: amount,
      };
      if (game.currentAuction.type === 'once') {
        update['currentAuction.turnIndex'] =
          (game.currentAuction.turnIndex || 0) + 1;
      }
    }

    await firestore().collection('games').doc(gameId).update(update);
    setBidInput('');
    setHasBid(true);
  };

  // Aceptar precio fijo
  const acceptFixedPrice = async () => {
    const auction = game.currentAuction;
    if (player.money < auction.fixedPrice) return;

    const wonArtworks = auction.artwork
      .split(' + ')
      .map((title: string) => ({ title, artist: auction.artist }));

    const updatedPlayers = players.map((p: any) => {
      if (p.uid === user.uid) {
        return {
          ...p,
          money: p.money - auction.fixedPrice,
          collection: [...collection, ...wonArtworks],
        };
      }
      if (p.uid === auction.sellerId) {
        return { ...p, money: p.money + auction.fixedPrice };
      }
      return p;
    });

    const newArtistCounts = { ...(game.artistCounts || {}) };
    newArtistCounts[auction.artist] =
      (newArtistCounts[auction.artist] || 0) + wonArtworks.length;

    const nextIndex =
      (players.findIndex((p: any) => p.uid === auction.sellerId) + 1) %
      players.length;
    const nextUid = players[nextIndex]?.uid;

    await firestore().collection('games').doc(gameId).update({
      players: updatedPlayers,
      currentAuction: firestore.FieldValue.delete(),
      artistCounts: newArtistCounts,
      currentTurn: nextUid,
    });

    await checkAndAdvanceRound(gameId);
  };

  // Finalizar subasta (UI alternativa)
  const handleFinishAuction = async () => {
    const auction = game.currentAuction;
    let bids = auction.bids || {};
    let winner = auction.highestBidder;
    let max = auction.highestBid;
    if (auction.type !== 'open') {
      for (const [uid, val] of Object.entries(bids)) {
        const value = val as number;
        if (value > max) {
          max = value;
          winner = uid;
        }
      }
    }
    if (!winner) {
      await firestore().collection('games').doc(gameId).update({
        currentAuction: firestore.FieldValue.delete(),
      });
      return;
    }

    const wonArtworks = auction.artwork
      .split(' + ')
      .map((title: string) => ({ title, artist: auction.artist }));

    const updatedPlayers = players.map((p: any) => {
      if (p.uid === winner) {
        return {
          ...p,
          money: p.money - max,
          collection: [...collection, ...wonArtworks],
        };
      }
      if (p.uid === auction.sellerId) {
        return { ...p, money: p.money + max };
      }
      return p;
    });

    const newArtistCounts = { ...(game.artistCounts || {}) };
    newArtistCounts[auction.artist] =
      (newArtistCounts[auction.artist] || 0) + wonArtworks.length;

    const nextIndex =
      (players.findIndex((p: any) => p.uid === auction.sellerId) + 1) %
      players.length;
    const nextUid = players[nextIndex]?.uid;

    await firestore().collection('games').doc(gameId).update({
      players: updatedPlayers,
      currentAuction: firestore.FieldValue.delete(),
      artistCounts: newArtistCounts,
      currentTurn: nextUid,
    });

    await checkAndAdvanceRound(gameId);
  };

  // Render de cartas
  const renderCard = ({ item }: { item: any }) => (
    <TouchableOpacity
      onPress={() =>
        selectedCard ? setSecondCard(item) : setSelectedCard(item)
      }
      style={styles.card}
    >
      <Text style={{ fontWeight: 'bold' }}>{item.title}</Text>
      <Text>{item.artist}</Text>
      <Text>{item.auctionType}</Text>
    </TouchableOpacity>
  );

  // UI de subasta
  const renderAuctionUI = () => {
    const auction = game.currentAuction;
    const type = auction.type;

    return (
      <>
        <Text style={styles.subtitle}>
          Vendedor: {getPlayerName(auction.sellerId)}
        </Text>
        <Text style={styles.subtitle}>
          Obra: {auction.artwork} | Tipo: {type}
        </Text>

        {type === 'fixed' && isSeller && (
          <TextInput
            placeholder="Precio fijo"
            value={fixedPriceInput}
            onChangeText={setFixedPriceInput}
            keyboardType="numeric"
            style={styles.input}
          />
        )}

        {(type === 'open' || type === 'once' || type === 'sealed') &&
          user.uid !== auction.sellerId &&
          !hasBid && (
            <>
              <TextInput
                placeholder="Ingresá tu puja"
                value={bidInput}
                onChangeText={setBidInput}
                keyboardType="numeric"
                style={styles.input}
              />
              <Button title="Pujar" onPress={submitBid} />
            </>
          )}

        {type === 'fixed' && !isSeller && (
          <Button
            title={`Comprar por $${auction.fixedPrice}`}
            onPress={acceptFixedPrice}
          />
        )}

        {isSeller && (
          <Button
            title="Finalizar subasta"
            onPress={handleFinishAuction}
          />
        )}
      </>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Ronda {game.round} - Turno de: {getPlayerName(game.currentTurn)}
      </Text>

      {game.currentAuction ? (
        renderAuctionUI()
      ) : (
        <>
          <Text style={styles.subtitle}>Tu mano</Text>
          <FlatList
            data={hand}
            renderItem={renderCard}
            keyExtractor={(item) => item.id}
            horizontal
          />
          {isMyTurn && (
            <Button
              title="Iniciar subasta"
              onPress={handleStartAuction}
              disabled={!selectedCard || (selectedCard.auctionType === 'double' && !secondCard)}
            />
          )}
        </>
      )}

      <Text style={styles.subtitle}>Tu saldo: ${player.money}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 20, fontWeight: 'bold' },
  subtitle: { fontSize: 16, marginVertical: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#999',
    padding: 8,
    marginVertical: 10,
    borderRadius: 5,
  },
  card: {
    padding: 10,
    margin: 6,
    borderWidth: 1,
    borderColor: '#aaa',
    borderRadius: 6,
    backgroundColor: '#f9f9f9',
    minWidth: 100,
    alignItems: 'center',
  },
});
