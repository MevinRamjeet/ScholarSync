import { router } from "expo-router";
import { Button, StyleSheet, Text, View } from "react-native";

export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>ScholarSync Login</Text>
      <Text>Authentication will go here later.</Text>
      <Button
        title="Bypass Login (Dummy Auth)"
        onPress={() => router.replace("/(tabs)/dashboard")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
});
