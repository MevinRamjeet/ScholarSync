import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "blue" }}>
      <Tabs.Screen
        name="dashboard"
        options={{ title: "Dashboard", tabBarLabel: "Home" }}
      />
      <Tabs.Screen
        name="tasks"
        options={{ title: "Tasks", tabBarLabel: "Tracker" }}
      />
      <Tabs.Screen
        name="scanner"
        options={{ title: "Scanner", tabBarLabel: "Scan" }}
      />
      <Tabs.Screen
        name="timer"
        options={{ title: "Timer", tabBarLabel: "Focus" }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings", tabBarLabel: "Settings" }}
      />
    </Tabs>
  );
}
