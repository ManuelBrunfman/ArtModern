import React from 'react';
import { View, Button, StyleSheet } from 'react-native';

interface Props {
  type: string;
  onFinish: () => void;
  onCancel: () => void;
  onReveal?: () => void;
}

const SellerActions: React.FC<Props> = ({ type, onFinish, onCancel, onReveal }) => (
  <View style={styles.container}>
    {type === 'sealed' ? (
      <Button title="Revelar y finalizar" onPress={onReveal} />
    ) : (
      <Button title="Finalizar subasta" onPress={onFinish} />
    )}
    <Button title="Cancelar" color="#B00020" onPress={onCancel} />
  </View>
);

const styles = StyleSheet.create({
  container: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }
});

export default SellerActions;