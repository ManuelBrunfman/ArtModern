import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  visible: boolean;
  tiedBidders: string[];
  bids: Record<string, number>;
  getPlayerName: (id: string) => string;
  onResolve: (id: string) => void;
}

const TieBreakModal: React.FC<Props> = ({ visible, tiedBidders, bids, getPlayerName, onResolve }) => (
  <Modal visible={visible} transparent animationType="slide">
    <View style={styles.overlay}>
      <View style={styles.content}>
        <Text style={styles.title}>Resolver Empate</Text>
        {tiedBidders.map(uid => (
          <TouchableOpacity key={uid} style={styles.button} onPress={() => onResolve(uid)}>
            <Text>{getPlayerName(uid)} - ${bids[uid]}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  content: { backgroundColor: '#fff', padding: 20, borderRadius: 8 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  button: { padding: 10, backgroundColor: '#e1f5fe', borderRadius: 4, marginVertical: 4 }
});

export default TieBreakModal;