import { FlatList, StyleSheet, Text, View } from "react-native";
import TaskCard from "../../components/TaskCard";
import { dummyTasks } from "../../data/dummyTasks";

export default function TasksScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Smart Assignment Tracker</Text>
      <FlatList
        data={dummyTasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TaskCard task={item} />}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  header: { fontSize: 22, fontWeight: "bold", padding: 20, paddingBottom: 10 },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
});
