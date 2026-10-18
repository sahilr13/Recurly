import { Tabs, Redirect } from "expo-router";
import { View, Image } from "react-native";
import { tabs } from '../../constants/data';
import { colors, components } from '../../constants/theme';
import clsx from "clsx";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from '@clerk/expo';

const tabBar = components.tabBar;

interface TabIconProps {
    focused: boolean;
    icon: any;
}

const TabIcon = ({ focused, icon }: TabIconProps) => {
    return (
        <View className="tabs-icon">
            <View className={clsx('tabs-pill', focused && 'tabs-active')}>
                {icon ? (
                    <Image source={icon} resizeMode="contain" className="tabs-glyph" />
                ) : null}
            </View>
        </View>
    );
};

// Exact screen files in app/(tabs)/
const VALID_SCREENS = [
    { name: 'index', title: 'Home', fallbackMatch: ['index', 'home'] },
    { name: 'subscriptions', title: 'Subscriptions', fallbackMatch: ['subscriptions', 'subcription', 'subscription'] },
    { name: 'insights', title: 'Insights', fallbackMatch: ['insights', 'insight'] },
    { name: 'settings', title: 'Settings', fallbackMatch: ['settings', 'setting', 'profile'] },
];

export default function TabLayout() {
    const { isSignedIn, isLoaded } = useAuth();
    const insets = useSafeAreaInsets();

    if (!isLoaded) {
        return null;
    }

    if (!isSignedIn) {
        return <Redirect href="/(auth)/sign-in" />;
    }

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarShowLabel: false,
                tabBarStyle: {
                    position: 'absolute',
                    bottom: Math.max(insets.bottom, tabBar.horizontalInset),
                    height: tabBar.height,
                    marginHorizontal: tabBar.horizontalInset,
                    borderRadius: tabBar.radius,
                    backgroundColor: colors.primary,
                    borderTopWidth: 0,
                    elevation: 0,
                },
                tabBarItemStyle: {
                    paddingVertical: tabBar.height / 2 - tabBar.iconFrame / 1.6,
                },
                tabBarIconStyle: {
                    width: tabBar.iconFrame,
                    height: tabBar.iconFrame,
                    alignItems: 'center',
                },
            }}
        >
            {VALID_SCREENS.map((screen) => {
                // Find matching icon from your data file safely
                const tabData = tabs.find((t) => 
                    screen.fallbackMatch.includes(t.name?.toLowerCase()) || 
                    t.title?.toLowerCase() === screen.title.toLowerCase()
                );

                return (
                    <Tabs.Screen
                        key={screen.name}
                        name={screen.name}
                        options={{
                            title: screen.title,
                            tabBarIcon: ({ focused }) => (
                                <TabIcon focused={focused} icon={tabData?.icon} />
                            ),
                        }}
                    />
                );
            })}
        </Tabs>
    );
}