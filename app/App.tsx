import React, { useEffect, useMemo } from 'react';
import { StatusBar, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
// Import the exact weights by subpath — importing the package root would bundle
// every weight of all three families (~7MB of unused ttf).
import { Archivo_600SemiBold } from '@expo-google-fonts/archivo/600SemiBold';
import { Archivo_700Bold } from '@expo-google-fonts/archivo/700Bold';
import { Archivo_800ExtraBold } from '@expo-google-fonts/archivo/800ExtraBold';
import { Barlow_400Regular } from '@expo-google-fonts/barlow/400Regular';
import { Barlow_600SemiBold } from '@expo-google-fonts/barlow/600SemiBold';
import { Barlow_700Bold } from '@expo-google-fonts/barlow/700Bold';
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono/400Regular';
import { IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono/600SemiBold';

import { AppHeader } from './src/components/AppHeader';
import { DevPanel } from './src/components/DevPanel';
import { NotifBanner, TabBar, Toast } from './src/components/chrome';
import { ActiveSheet } from './src/components/sheets';
import { TAP_TARGET } from './src/config';
import { configureNotifications } from './src/notifications/nudge';
import { CaptureScreen } from './src/screens/CaptureScreen';
import { ClockScreen } from './src/screens/ClockScreen';
import { DayLogScreen } from './src/screens/DayLogScreen';
import { ShiftProvider, useShift } from './src/state/shiftStore';
import { DAY, SUN, ThemeContext } from './src/theme/theme';

void SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded] = useFonts({
    Archivo_600SemiBold,
    Archivo_700Bold,
    Archivo_800ExtraBold,
    Barlow_400Regular,
    Barlow_600SemiBold,
    Barlow_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_600SemiBold,
  });

  useEffect(() => {
    void configureNotifications();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <ShiftProvider>
        <Shell />
      </ShiftProvider>
    </SafeAreaProvider>
  );
}

function Shell() {
  const s = useShift();
  const insets = useSafeAreaInsets();

  const theme = useMemo(() => ({ sun: s.sun, c: s.sun ? SUN : DAY, tap: TAP_TARGET }), [s.sun]);

  useEffect(() => {
    if (s.ready) void SplashScreen.hideAsync();
  }, [s.ready]);

  if (!s.ready) return null;

  // The design assumes 62px of chrome above the header — that is the status
  // bar plus a hair. Driving it off the real inset keeps it right on every
  // device instead of only on the one the mockup was drawn at.
  const topPad = insets.top + 3;
  const bottomPad = Math.max(insets.bottom - 8, 12);

  return (
    <ThemeContext.Provider value={theme}>
      <View style={{ flex: 1, backgroundColor: theme.c.bg }}>
        <StatusBar barStyle={s.sun ? 'light-content' : 'dark-content'} />

        {s.tab === 'job' ? (
          <View style={{ flex: 1, paddingTop: topPad }}>
            <AppHeader />
            <ClockScreen />
          </View>
        ) : null}

        {s.tab === 'cam' ? <CaptureScreen topInset={topPad} /> : null}

        {s.tab === 'log' ? (
          <View style={{ flex: 1, paddingTop: topPad }}>
            <DayLogScreen />
          </View>
        ) : null}

        <TabBar bottomInset={bottomPad} />

        <NotifBanner topInset={topPad} />
        <Toast bottomInset={bottomPad} />
        <DevPanel />
        <ActiveSheet />
      </View>
    </ThemeContext.Provider>
  );
}
