import React from 'react';
import { FlatList, Text, View, StyleSheet } from 'react-native';

interface Props {
  bids: Record<string, number>;
  visible: boolean;
  getPlayerName: (id: string) => string;
}

const BidList: React.FC<Props> = ({ bids, visible, getPlayerName }) => {
  if (!visible) return null;
  const data = Object.entries(bids);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pujas:</Text>
      <FlatList
        data={data}
        keyExtractor={([uid]) => uid}
        renderItem={({ item: [uid, amount] }) => (
          <Text style={styles.item}>{getPlayerName(uid)}: ${amount}</Text>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginVertical: 8 },
  title: { fontWeight: 'bold' },
  item: { marginLeft: 8 }
});

export default BidList;