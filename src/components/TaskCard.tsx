import { StyleSheet, Text, View } from "react-native";
import { Task } from "../data/dummyTasks";

export default function TaskCard({ task }: { task: Task }) {
  const isCompleted = task.status === "completed";

  return (
    <View style={styles.card}>
      <View>
        <Text style={styles.title}>{task.title}</Text>
        <Text style={styles.course}>{task.course}</Text>
      </View>
      <View style={styles.rightSide}>
        <Text
          style={[
            styles.status,
            { color: isCompleted ? "#4CAF50" : "#FF9800" },
          ]}
        >
          {task.status.toUpperCase()}
        </Text>
        <Text style={styles.date}>Due: {task.dueDate}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: { fontSize: 16, fontWeight: "bold", color: "#333" },
  course: { fontSize: 14, color: "#666", marginTop: 4 },
  rightSide: { alignItems: "flex-end" },
  status: { fontSize: 12, fontWeight: "bold", marginBottom: 4 },
  date: { fontSize: 12, color: "#999" },
});
