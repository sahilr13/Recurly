import { Tabs } from "expo-router";
import { View } from "react-native";
import { tabs } from '../../constants/data';
import { colors, components} from '../../constants/theme';
import clsx from "clsx";
import { Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Defined the missing props interface
interface TabIconProps {
  focused: boolean;
  icon: any; // Update 'any' to your specific icon type (e.g., ImageSourcePropType)
}

const tabBar = components.tabBar;
const TabLayout = () => {
  // Fixed arrow function syntax to implicitly return the JSX
  const insets = useSafeAreaInsets();

  const TabIcon = ({ focused, icon }: TabIconProps) => (
    <View className="tabs-icon">
        <View className={clsx('tabs-pill', focused && 'tabs-active')}>
            <Image source ={icon} resizeMode="contain" className="tabs-glyph" />
        </View>
    </View>
  );

  return (
    <Tabs  
    screenOptions={{
         headerShown: false,
         tabBarShowLabel: false,
         tabBarStyle: {
            position:'absolute',
            bottom: Math.max(insets.bottom, tabBar.horizontalInset ),
            height: tabBar.height,
            margin: tabBar.horizontalInset,
            borderRadius: tabBar.radius,
            backgroundColor: colors.primary,
            borderTopWidth: 0,
            elevation: 0,
         },
         tabBarItemStyle:{
            paddingVertical: tabBar.height / 2 - tabBar.iconFrame / 1.6
         },
         tabBarIconStyle:{
            width: tabBar.iconFrame,
            height: tabBar.iconFrame,
            alignItems: 'center', 
         }
         }}>
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title, // Added missing comma
            tabBarIcon: ({ focused }) => (
              // Passed the focused state and icon prop correctly
              <TabIcon focused={focused} icon={tab.icon} />
            ),
          }} 
        />
      ))}
    </Tabs>
  );
};

export default TabLayout;