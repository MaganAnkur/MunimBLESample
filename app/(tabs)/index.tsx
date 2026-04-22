import Constants from 'expo-constants';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { BLEDevice } from 'munim-bluetooth';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

type ScannedDevice = {
  id: string;
  name: string;
  rssi: number | null;
};

const SCAN_DURATION_MS = 10_000;

export default function HomeScreen() {
  const removeDeviceFoundListenerRef = useRef<(() => void) | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const devicesCountRef = useRef(0);

  const [statusMessage, setStatusMessage] = useState(
    Platform.OS === 'web'
      ? 'munim-bluetooth is ready for iOS and Android development builds.'
      : 'Tap the button to check Bluetooth and scan for nearby devices.'
  );
  const [isChecking, setIsChecking] = useState(false);
  const [devices, setDevices] = useState<ScannedDevice[]>([]);

  useEffect(() => {
    devicesCountRef.current = devices.length;
  }, [devices]);

  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }

      removeDeviceFoundListenerRef.current?.();
      removeDeviceFoundListenerRef.current = null;

      if (Platform.OS === 'web') {
        return;
      }

      void import('munim-bluetooth')
        .then((bluetooth) => {
          bluetooth.stopScan();
        })
        .catch(() => {
          // Ignore cleanup failures.
        });
    };
  }, []);

  const stopScanSession = async () => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }

    removeDeviceFoundListenerRef.current?.();
    removeDeviceFoundListenerRef.current = null;

    if (Platform.OS === 'web') {
      return;
    }

    try {
      const bluetooth = await import('munim-bluetooth');
      bluetooth.stopScan();
    } catch {
      // Ignore cleanup failures.
    }
  };

  const handleBluetoothCheck = async () => {
    if (Platform.OS === 'web') {
      setStatusMessage(
        'Bluetooth checks run in native development builds. Use expo run:ios or expo run:android.'
      );
      return;
    }

    if (Constants.appOwnership === 'expo') {
      setStatusMessage(
        'Munim Bluetooth requires a native development build. Expo Go cannot load this Bluetooth module.'
      );
      return;
    }

    setIsChecking(true);
    setDevices([]);

    try {
      const bluetooth = await import('munim-bluetooth');
      await stopScanSession();

      const hasPermission = await bluetooth.requestBluetoothPermission();
      if (!hasPermission) {
        setStatusMessage('Bluetooth permission was not granted.');
        return;
      }

      const enabled = await bluetooth.isBluetoothEnabled();
      if (!enabled) {
        setStatusMessage('Bluetooth permission is granted, but Bluetooth is currently turned off.');
        return;
      }

      removeDeviceFoundListenerRef.current = bluetooth.addDeviceFoundListener(
        (device: BLEDevice) => {
          setDevices((currentDevices) => {
            const nextDevice: ScannedDevice = {
              id: device.id,
              name: String(device.name ?? '').trim() || 'Unnamed device',
              rssi:
                typeof device.rssi === 'number' && Number.isFinite(device.rssi)
                  ? device.rssi
                  : null,
            };

            const existingIndex = currentDevices.findIndex(
              (currentDevice) => currentDevice.id === nextDevice.id
            );

            if (existingIndex === -1) {
              return [...currentDevices, nextDevice].sort(compareDevicesBySignal);
            }

            const nextDevices = [...currentDevices];
            nextDevices[existingIndex] = nextDevice;
            return nextDevices.sort(compareDevicesBySignal);
          });
        }
      );

      bluetooth.startScan({
        allowDuplicates: false,
        scanMode: 'balanced',
      });

      setStatusMessage('Bluetooth is on. Scanning for nearby devices for 10 seconds...');

      scanTimeoutRef.current = setTimeout(() => {
        void stopScanSession().then(() => {
          const count = devicesCountRef.current;
          setStatusMessage(
            count > 0
              ? `Scan finished. Found ${count} device${count === 1 ? '' : 's'}.`
              : 'Scan finished. No nearby Bluetooth devices were found.'
          );
        });
      }, SCAN_DURATION_MS);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown native module error.';

      setStatusMessage(
        `munim-bluetooth could not load in this build. Create a native development build and rebuild the app. Details: ${message}`
      );
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <ThemedText type="title">Bluetooth Check</ThemedText>
          <ThemedText style={styles.body}>
            Tap the button to check Bluetooth, run a short scan, and list any nearby
            devices that are discovered.
          </ThemedText>

          <Pressable
            accessibilityRole="button"
            disabled={isChecking}
            onPress={handleBluetoothCheck}
            style={({ pressed }) => [
              styles.button,
              (pressed || isChecking) && styles.buttonPressed,
            ]}
          >
            {isChecking ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <ThemedText style={styles.buttonLabel}>Check Bluetooth</ThemedText>
            )}
          </Pressable>

          <ThemedView style={styles.card}>
            <ThemedText type="defaultSemiBold">Status</ThemedText>
            <ThemedText style={styles.statusText}>{statusMessage}</ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <ThemedText type="defaultSemiBold">Nearby Devices</ThemedText>
            {devices.length === 0 ? (
              <ThemedText style={styles.note}>No devices found yet.</ThemedText>
            ) : (
              devices.map((device) => (
                <View key={device.id} style={styles.deviceRow}>
                  <ThemedText type="defaultSemiBold">{device.name}</ThemedText>
                  <ThemedText style={styles.deviceMeta}>{device.id}</ThemedText>
                  <ThemedText style={styles.deviceMeta}>
                    RSSI: {device.rssi ?? 'Unknown'}
                  </ThemedText>
                </View>
              ))
            )}
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function compareDevicesBySignal(left: ScannedDevice, right: ScannedDevice) {
  const leftSignal = left.rssi ?? -Infinity;
  const rightSignal = right.rssi ?? -Infinity;

  return rightSignal - leftSignal;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },
  body: {
    opacity: 0.85,
  },
  button: {
    minHeight: 52,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a7ea4',
  },
  buttonPressed: {
    opacity: 0.82,
  },
  buttonLabel: {
    color: '#ffffff',
    fontWeight: '600',
  },
  card: {
    borderRadius: 20,
    padding: 16,
    gap: 8,
    backgroundColor: '#f4f8fb',
  },
  statusText: {
    opacity: 0.85,
  },
  note: {
    opacity: 0.7,
  },
  deviceRow: {
    gap: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#d0d7de',
  },
  deviceMeta: {
    opacity: 0.7,
  },
});
