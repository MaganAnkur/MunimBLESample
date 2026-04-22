import { isBluetoothEnabled } from "munim-bluetooth";
import { useEffect, useState } from "react";
import { Button, Text, View } from "react-native";

export default function HomeScreen() {
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);

  useEffect(() => {
    isBluetoothEnabled().then(setBluetoothEnabled);
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Button title="Start Advertising" onPress={() => {}} />
      <Button title="Stop Advertising" onPress={() => {}} />
      <Button title="Set Services" onPress={() => {}} />
      <Text>
        {bluetoothEnabled ? "Bluetooth is enabled" : "Bluetooth is disabled"}
      </Text>
    </View>
  );
}
