import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import TaskCard from "../../components/TaskCard";
import { supabase } from "../../services/supabase";

export default function TasksScreen() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    // Supabase will automatically only return tasks matching the logged-in user's ID thanks to RLS!
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("due_date", { ascending: true });

    if (!error && data) {
      setTasks(data);
    }
    setLoading(false);
  };

  const addTask = async () => {
    if (!newTaskTitle.trim()) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { error } = await supabase.from("tasks").insert({
        user_id: user.id,
        title: newTaskTitle,
        course: "General", // Defaulting for now
        due_date: new Date().toISOString().split("T")[0], // Today's date
        status: "pending",
      });

      if (!error) {
        setNewTaskTitle("");
        fetchTasks(); // Refresh the list
      } else {
        alert(error.message);
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>All Assignments</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="New task..."
          value={newTaskTitle}
          onChangeText={setNewTaskTitle}
        />
        <TouchableOpacity style={styles.addBtn} onPress={addTask}>
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#4A90E2"
          style={{ marginTop: 20 }}
        />
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          // We map database fields to our component's expected props
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
          ListEmptyComponent={
            <Text style={styles.empty}>No tasks yet. Add one above!</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  header: { fontSize: 22, fontWeight: "bold", padding: 20, paddingBottom: 10 },
  inputContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: "white",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  addBtn: {
    backgroundColor: "#4A90E2",
    justifyContent: "center",
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  addBtnText: { color: "white", fontWeight: "bold" },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  empty: { textAlign: "center", marginTop: 40, color: "#666" },
});
