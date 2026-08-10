import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import TaskCard from "../../components/TaskCard";
import { supabase } from "../../services/supabase";

export default function DashboardScreen() {
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Use focus listener to refresh data every time user navigates to this tab
  useEffect(() => {
    const fetchPendingTasks = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("status", "pending")
        .order("due_date", { ascending: true })
        .limit(3); // Only show top 3 on dashboard

      if (!error && data) {
        setPendingTasks(data);
      }
      setLoading(false);
    };

    fetchPendingTasks();
  }, []); // Note: in a real app, use useFocusEffect from expo-router to refetch on tab focus

  return (
    <View style={styles.container}>
      <View style={styles.summaryBox}>
        <Text style={styles.welcome}>Welcome back, Scholar!</Text>
        <Text style={styles.subtitle}>
          You have {pendingTasks.length} upcoming tasks.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Up Next</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#4A90E2" />
      ) : (
        <FlatList
          data={pendingTasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TaskCard
              task={{
                id: item.id,
                title: item.title,
                course: item.course,
                dueDate: item.due_date,
                status: item.status,
              }}
            />
          )}
          contentContainerStyle={styles.list}
          scrollEnabled={false}
          ListEmptyComponent={
            <Text style={styles.empty}>You're all caught up!</Text>
          }
        />
      )}
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
  empty: {
    textAlign: "center",
    marginTop: 20,
    color: "#666",
    fontStyle: "italic",
  },
});
