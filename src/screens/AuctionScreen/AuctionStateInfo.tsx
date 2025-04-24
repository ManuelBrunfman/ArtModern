// src/screens/AuctionScreen/AuctionStateInfo.tsx
/**
 * Muestra el estado resumido de la subasta vigente.
 *  • Tipo de subasta y precio fijo (cuando aplica)
 *  • Oferta más alta y quién la hizo
 *  • Cantidad de pujas recibidas / jugadores totales
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type AuctionType = 'open' | 'sealed' | 'once' | 'fixed' | 'double';

/* ──────────────── Props ──────────────── */
interface Props {
  /** open | sealed | once | fixed | double */
  auctionType: AuctionType;

  highestBid:    number;
  highestBidder: string | undefined;   // nombre ya formateado
  bidsReceived:  number;
  totalPlayers:  number;
  /** sólo para subasta de precio fijo */
  fixedPrice?:   number;
}

/* ──────────────── Componente ──────────────── */
export default function AuctionStateInfo({
  auctionType,
  highestBid,
  highestBidder,
  bidsReceived,
  totalPlayers,
  fixedPrice,
}: Props) {
  /* Texto legible para el tipo */
  const typeLabel: Record<AuctionType, string> = {
    open   : 'Subasta abierta',
    sealed : 'Sobre cerrado',
    once   : 'Una vuelta',
    fixed  : 'Precio fijo',
    double : 'Doble subasta',
  };

  return (
    <View style={styles.container}>
      <Text style={styles.type}>{typeLabel[auctionType]}</Text>

      {auctionType === 'fixed' && (
        <Text style={styles.fixed}>
          Precio: <Text style={styles.bold}>{fixedPrice ?? 0}€</Text>
        </Text>
      )}

      <Text>
        Oferta más alta:{' '}
        {highestBid > 0
          ? `${highestBid}€ (${highestBidder})`
          : '— ninguna —'}
      </Text>

      <Text style={styles.small}>
        Pujas recibidas: {bidsReceived}/{totalPlayers}
      </Text>
    </View>
  );
}

/* ──────────────── Estilos ──────────────── */
const styles = StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginVertical: 8,
    elevation: 2,
  },
  type: {
    fontWeight: '700',
    marginBottom: 4,
  },
  fixed: {
    marginBottom: 4,
  },
  bold: {
    fontWeight: '700',
  },
  small: {
    fontSize: 12,
    color: '#555',
    marginTop: 2,
  },
});
