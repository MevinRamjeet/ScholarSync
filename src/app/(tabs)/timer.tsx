import { StyleSheet, Text, View } from "react-native";
export default function TimerScreen() {
  return (
    <View style={styles.container}>
      <Text>Pomodoro Focus Timer</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
});
