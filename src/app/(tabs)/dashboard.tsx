import { FlatList, StyleSheet, Text, View } from "react-native";
import TaskCard from "../../components/TaskCard";
import { dummyTasks } from "../../data/dummyTasks";

export default function DashboardScreen() {
  const pendingTasks = dummyTasks.filter((task) => task.status === "pending");

  return (
    <View style={styles.container}>
      <View style={styles.summaryBox}>
        <Text style={styles.welcome}>Welcome back, Scholar!</Text>
        <Text style={styles.subtitle}>
          You have {pendingTasks.length} tasks to complete.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Up Next</Text>
      <FlatList
        data={pendingTasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TaskCard task={item} />}
        contentContainerStyle={styles.list}
        scrollEnabled={false} // Prevents nested scrolling issues if you add a ScrollView later
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  summaryBox: {
    backgroundColor: "#4A90E2",
    padding: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 20,
  },
  welcome: { fontSize: 24, fontWeight: "bold", color: "#fff" },
  subtitle: { fontSize: 16, color: "#E2E8F0", marginTop: 8 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginHorizontal: 20,
    marginBottom: 12,
    color: "#333",
  },
  list: { paddingHorizontal: 20 },
});
