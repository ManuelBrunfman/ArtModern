import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet } from 'react-native';

interface Props {
  type: string;
  onSubmit: (amount: number) => void;
  disabled: boolean;
  fixedPrice?: number;
}

const BidInput: React.FC<Props> = ({ type, onSubmit, disabled, fixedPrice }) => {
  const [value, setValue] = useState('');
  return (
    <View style={styles.container}>
      {type === 'fixed' ? (
        <Button
          title={`Comprar a $${fixedPrice}`}
          onPress={() => onSubmit(fixedPrice!)}
          disabled={disabled}
        />
      ) : (
        <>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            keyboardType="numeric"
            editable={!disabled}
          />
          <Button
            title="Ofertar"
            onPress={() => onSubmit(parseInt(value, 10))}
            disabled={disabled || !value}
          />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#999', padding: 4, marginRight: 8 }
});

export default BidInput;