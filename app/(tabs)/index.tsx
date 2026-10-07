import { Link } from "expo-router";

import "../../global.css"
import { Text } from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";
import {styled} from "nativewind";
const SafeAreaView = styled(RNSafeAreaView);

export default function App() {
  return (
    <SafeAreaView className="flex-1 bg-background p-5">
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
    </SafeAreaView>
  );
}