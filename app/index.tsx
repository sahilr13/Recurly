import { Link } from "expo-router";
import "../global.css"
import { Text, View } from "react-native";
 
export default function App() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-xl font-bold text-success">
        Welcome to Nativewind!
      </Text>
      <Link href="/onboarding" className="mt-4 rounded-2xl bg-primary text-white p-4">Go to Onboarding</Link>
      <Link href="/(auth)/sign-in" className="mt-4 rounded-2xl bg-primary text-white p-4">Go to SignIn</Link>
      <Link href="/(auth)/sign-up" className="mt-4 rounded-2xl bg-primary text-white p-4">Go to SignUp</Link>

      <Link href="/subcriptions/spotify">Spotify Subcription</Link>
      <Link href={{
        pathname: "/subcriptions/[id]",
        params: {id: "claude"},
      }}>
        Claude Max Subcriptions
      </Link>
    </View>
  );
}