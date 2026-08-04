import { StyleSheet, Text, View } from "react-native";
export default function TasksScreen() {
  return (
    <View style={styles.container}>
      <Text>Smart Assignment Tracker</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
});
