import React from 'react';
import { Stack } from 'expo-router';
import { AuthProvider } from '../src/context/AuthContext';
import { AudioProvider } from '../src/context/AudioContext';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <AuthProvider>
      <AudioProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#090a0f' },
            headerTintColor: '#ffffff',
            contentStyle: { backgroundColor: '#090a0f' },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="playlist/[id]" options={{ title: 'Playlist' }} />
          <Stack.Screen name="album/[id]" options={{ title: 'Album' }} />
          <Stack.Screen name="custom/[id]" options={{ title: 'Custom Playlist' }} />
          <Stack.Screen name="podcast/[id]" options={{ title: 'Podcast' }} />
          <Stack.Screen name="admin/index" options={{ title: 'Admin Panel' }} />
          <Stack.Screen name="modals/auth" options={{ presentation: 'modal', title: 'Account Sign In' }} />
          <Stack.Screen name="modals/profile" options={{ presentation: 'modal', title: 'User Profile' }} />
          <Stack.Screen name="modals/theme" options={{ presentation: 'modal', title: 'Theme Selector' }} />
          <Stack.Screen name="modals/queue" options={{ presentation: 'formSheet', title: 'Play Queue' }} />
          <Stack.Screen name="player/lyrics" options={{ presentation: 'fullScreenModal', title: 'Lyrics' }} />
        </Stack>
      </AudioProvider>
    </AuthProvider>
  );
}
