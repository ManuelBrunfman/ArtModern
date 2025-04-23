import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  highestBid?: number;
  highestBidder?: string;
  bidsReceived?: number;
  totalPlayers?: number;
}

const AuctionStateInfo: React.FC<Props> = ({ highestBid, highestBidder, bidsReceived, totalPlayers }) => (
  <View style={styles.container}>
    {highestBid !== undefined ? (
      <Text>Última oferta: ${highestBid} por {highestBidder}</Text>
    ) : bidsReceived !== undefined ? (
      <Text>Pujas recibidas: {bidsReceived} / {totalPlayers}</Text>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  container: { marginVertical: 8 }
});

export default AuctionStateInfo;