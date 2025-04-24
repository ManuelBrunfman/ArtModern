/**
 * Input de puja para open / sealed / once.
 * • Muestra el saldo disponible.
 * • Usa teclado numérico y no cierra el pad al teclear.
 */
import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet, Text } from 'react-native';

export type AuctionType = 'open' | 'sealed' | 'once' | 'fixed' | 'double';

interface Props {
  type: AuctionType;
  fixedPrice: number;
  disabled: boolean;
  onSubmit: (amount: number) => void;
  currentMoney: number;
}

export default function BidInput({
  type,
  fixedPrice,
  disabled,
  onSubmit,
  currentMoney,
}: Props) {
  const [text, setText] = useState('');

  const placeholder =
    type === 'sealed' ? 'Puja secreta' : 'Ingresa tu oferta';

  const handleSend = () => {
    const n = parseInt(text, 10);
    if (!isNaN(n)) onSubmit(n);
    setText('');
  };

  return (
    <View style={styles.box}>
      <Text style={styles.money}>Tu saldo: €{currentMoney}</Text>

      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          keyboardType="number-pad"
          editable={!disabled}
          // no ponemos "value" vacío al tocar send ⇒ el teclado NO se cierra
        />
        <Button
          title="Ofertar"
          onPress={handleSend}
          disabled={disabled || text.trim() === ''}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', marginVertical: 8 },
  money: { textAlign: 'center', marginBottom: 4, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 4,
    padding: 6,
  },
});
