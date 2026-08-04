import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      {/* You can add signup here later: <Stack.Screen name="signup" /> */}
    </Stack>
  );
}
