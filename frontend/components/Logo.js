// frontend/components/Logo.js
import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

export default function Logo() {
  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/E-1.png')}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 20,
  },
  logo: {
    width: 100,
    height: 100,
  },
});
