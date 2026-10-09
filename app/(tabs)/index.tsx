import { Link } from "expo-router";

import "../../global.css"
import { Text , View ,Image, FlatList } from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";
import {styled} from "nativewind";
import images from "../../constants/images";
import { HOME_BALANCE, HOME_SUBSCRIPTIONS, HOME_USER, UPCOMING_SUBSCRIPTIONS } from "../../constants/data";
import { formatCurrency } from "../../lib/utils";
import dayjs from "dayjs";
import { icons } from "../../constants/icons";
import ListHeading from "../../components/ListHeading";
import UpcomingSubcriptionCard from "../../components/UpcomingSubcriptionCard";
import SubcriptionCard from "../../components/SubcriptionCard";
import { useState } from "react";
import { useUser } from '@clerk/expo';
import { posthog, posthogLog } from '../../lib/posthog';
const SafeAreaView = styled(RNSafeAreaView);

export default function App() {
  const { user } = useUser();
   const [expandedSubscriptionId, setExpandedSubscriptionId] = useState<string | null>(null);
   // Get user display name: firstName, fullName, or email
    const displayName = user?.firstName || user?.fullName || user?.emailAddresses[0]?.emailAddress || 'User';
  return (
    // Changed p-5 to px-5 pt-5 so the bottom padding isn't cut off by the safe area
    <SafeAreaView className="flex-1 bg-background p-5">
        <FlatList 
          ListHeaderComponent={ () => (
            <>
                  <View className="home-header">
                    <View className="home-user">
                          <Image
                              source={user?.imageUrl ? { uri: user.imageUrl } : images.avatar}
                              className="home-avatar"
                            />
                        <Text className="home-user-name">{displayName}</Text>
                    </View>
                    <Image source={icons.add} className="home-add-icon" />
                  </View>

                  <View className="home-balance-card">
                      <Text className="home-balance-label">Balance</Text>

                      <View className="home-balance-row">
                        <Text className="home-balance-amount">
                            {formatCurrency(HOME_BALANCE.amount)}
                        </Text>
                        <Text className="home-balance-date">
                            {dayjs(HOME_BALANCE.nextRenewalDate).format('MM/DD')}
                        </Text>
                      </View>
                  </View>

                  <View className="mb-5">
                    <ListHeading title="Upcoming" />
                    <FlatList
                          data={UPCOMING_SUBSCRIPTIONS}
                          renderItem={({ item}) => (<UpcomingSubcriptionCard {...item} />)}
                          keyExtractor={(item) => item.id}
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          ListEmptyComponent={<Text className="home-empty-state">No upcoming renewals yet.</Text>}
                    />
                  </View>
                   <ListHeading title="All Subscriptions" />
            </>
          )}
          data={HOME_SUBSCRIPTIONS}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({item}) => (
            <SubcriptionCard 
                  {...item} 
                  expanded={expandedSubscriptionId === item.id}
                  onPress={() => {
                    const isExpanded = expandedSubscriptionId !== item.id;
                    posthog?.capture('subscription_details_toggled', {
                      subscription_id: item.id,
                      subscription_status: item.status ?? 'unknown',
                      billing_interval: item.billing.toLowerCase(),
                      is_expanded: isExpanded,
                    });
                    posthogLog.info('subscription details toggled', {
                      subscription_status: item.status ?? 'unknown',
                      billing_interval: item.billing.toLowerCase(),
                      is_expanded: isExpanded,
                    });
                    setExpandedSubscriptionId((currentId) => (currentId === item.id ? null: item.id));
                  }}
            />
          )}
          extraData={expandedSubscriptionId}
          ItemSeparatorComponent={() => <View className="h-4" />}
          ListEmptyComponent={<Text className="home-empty-state">No subcriptions yet.</Text>}
          // Removed the style prop and changed pb-30 to a valid Tailwind class (pb-32)
          contentContainerClassName="pb-32"
        />
    </SafeAreaView>
  );
}