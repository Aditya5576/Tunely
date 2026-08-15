import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function AuthModalScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign In / Register</Text>
      <Text style={styles.subtitle}>SCREEN PLACEHOLDER — IMPLEMENTATION PENDING</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#12141d',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#00e5ff',
    fontWeight: '600',
    textAlign: 'center',
  },
});
