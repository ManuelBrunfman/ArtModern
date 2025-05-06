// src/screens/AuctionScreen/AuctionStateInfo.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { AuctionType } from '../../types/game';

interface Props {
  /** Tipo de subasta (abierta, fija, etc.) */
  type?: AuctionType;
  /** Monto más alto ofertado hasta el momento */
  highestBid?: number;
  /** UID o nombre del mejor postor */
  highestBidder?: string;
  /** Cantidad de pujas recibidas en subastas sellada/una-vuelta/doble */
  bidsReceived?: number;
  /** Total de jugadores en la partida (para mostrar progreso) */
  totalPlayers?: number;
}

const AuctionStateInfo: React.FC<Props> = ({
  type,
  highestBid,
  highestBidder,
  bidsReceived,
  totalPlayers,
}) => (
  <View style={styles.container}>
    {highestBid !== undefined ? (
      <Text>Última oferta: ${highestBid} por {highestBidder ?? '—'}</Text>
    ) : bidsReceived !== undefined ? (
      <Text>Pujas recibidas: {bidsReceived} / {totalPlayers}</Text>
    ) : type ? (
      <Text>Tipo de subasta: {type}</Text>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  container: { marginVertical: 8 },
});

export default AuctionStateInfo;
