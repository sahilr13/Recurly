import { Link } from "expo-router";
import "../../global.css";
import { Text, View, Image, FlatList, Pressable } from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";
import { styled } from "nativewind";
import images from "../../constants/images";
import { formatCurrency } from "../../lib/utils";
import dayjs from "dayjs";
import { icons } from "../../constants/icons";
import ListHeading from "../../components/ListHeading";
import UpcomingSubcriptionCard from "../../components/UpcomingSubcriptionCard";
import SubcriptionCard from "../../components/SubcriptionCard";
import CreateSubscriptionModal from "../../components/CreateSubscriptionModal";
import { useState, useMemo } from "react";
import { useUser } from '@clerk/expo';
import { posthogLog } from '../../lib/posthog';
import { usePostHog } from 'posthog-react-native';
import { useSubscriptionStore } from "../../lib/subscriptionStore";

const SafeAreaView = styled(RNSafeAreaView);

export default function App() {
    const { user } = useUser();
    const posthog = usePostHog();
    const [expandedSubscriptionId, setExpandedSubscriptionId] = useState<string | null>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const { subscriptions, addSubscription } = useSubscriptionStore();

    // 1. Upcoming Subscriptions (Active & renewing within the next 30 days)
    const upcomingSubscriptions = useMemo(() => {
        const now = dayjs().startOf('day');
        const nextMonth = now.add(30, 'days');
        return subscriptions
            .filter((sub) => {
                if (sub.status !== 'active' || !sub.renewalDate) return false;
                const rDate = dayjs(sub.renewalDate);
                return (rDate.isAfter(now) || rDate.isSame(now, 'day')) && rDate.isBefore(nextMonth);
            })
            .sort((a, b) => dayjs(a.renewalDate).diff(dayjs(b.renewalDate)));
    }, [subscriptions]);

    // 2. Dynamic Monthly Balance Run-Rate & Next Renewal Date
    const { monthlySpend, primaryCurrency, nextRenewalDate } = useMemo(() => {
        if (!subscriptions || subscriptions.length === 0) {
            return { monthlySpend: 0, primaryCurrency: 'INR', nextRenewalDate: null };
        }

        let total = 0;
        let currency = 'INR';

        subscriptions.forEach((sub) => {
            if (sub.currency) currency = sub.currency;
            const freq = sub.frequency || sub.billing;
            if (freq === 'Yearly') total += sub.price / 12;
            else if (freq === 'Quarterly') total += sub.price / 3;
            else total += sub.price; // Monthly default
        });

        const nextDate = upcomingSubscriptions[0]?.renewalDate || null;

        return {
            monthlySpend: total,
            primaryCurrency: currency,
            nextRenewalDate: nextDate,
        };
    }, [subscriptions, upcomingSubscriptions]);

    const handleCreateSubscription = (newSubscription: Subscription) => {
        addSubscription(newSubscription);
        posthog?.capture('subscription_created', {
            subscription_name: newSubscription.name,
            subscription_price: newSubscription.price,
            subscription_currency: newSubscription.currency,
            subscription_frequency: newSubscription.frequency,
            subscription_category: newSubscription.category,
        });
    };

    const displayName = user?.firstName || user?.fullName || user?.emailAddresses[0]?.emailAddress || 'User';

    return (
        <SafeAreaView className="flex-1 bg-background p-5">
            <FlatList 
                ListHeaderComponent={() => (
                    <>
                        <View className="home-header">
                            <View className="home-user">
                                <Image
                                    source={user?.imageUrl ? { uri: user.imageUrl } : images.avatar}
                                    className="home-avatar"
                                />
                                <Text className="home-user-name">{displayName}</Text>
                            </View>
                            <Pressable onPress={() => setIsModalVisible(true)}>
                                <Image source={icons.add} className="home-add-icon" />
                            </Pressable>
                        </View>

                        {/* Real Dynamic Balance Card */}
                        <View className="home-balance-card">
                            <Text className="home-balance-label">Total Monthly Spend</Text>

                            <View className="home-balance-row">
                                <Text className="home-balance-amount">
                                    {formatCurrency(monthlySpend, primaryCurrency)}
                                </Text>
                                <Text className="home-balance-date">
                                    {nextRenewalDate ? `Next: ${dayjs(nextRenewalDate).format('DD MMM')}` : 'No renewals'}
                                </Text>
                            </View>
                        </View>

                        {/* Upcoming Horizontal Section */}
                        <View className="mb-5">
                            <ListHeading title="Upcoming Renewals" />
                            <FlatList
                                data={upcomingSubscriptions}
                                renderItem={({ item }) => (
                                    <UpcomingSubcriptionCard
                                        name={item.name}
                                        price={item.price}
                                        currency={item.currency}
                                        renewalDate={item.renewalDate}
                                        icon={item.icon}
                                    />
                                )}
                                keyExtractor={(item) => item.id}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                ListEmptyComponent={<Text className="home-empty-state">No upcoming renewals in the next 30 days.</Text>}
                            />
                        </View>
                        <ListHeading title="All Subscriptions" />
                    </>
                )}
                data={subscriptions}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                    <SubcriptionCard 
                        {...item} 
                        expanded={expandedSubscriptionId === item.id}
                        onPress={() => {
                            const isExpanded = expandedSubscriptionId !== item.id;
                            posthog?.capture('subscription_details_toggled', {
                                subscription_id: item.id,
                                is_expanded: isExpanded,
                            });
                            posthogLog?.info('subscription details toggled', {
                                subscription_id: item.id,
                                is_expanded: isExpanded,
                            });
                            setExpandedSubscriptionId((currentId) => (currentId === item.id ? null : item.id));
                        }}
                    />
                )}
                extraData={expandedSubscriptionId}
                ItemSeparatorComponent={() => <View className="h-4" />}
                ListEmptyComponent={<Text className="home-empty-state">No subscriptions added yet.</Text>}
                contentContainerClassName="pb-32"
            />

            <CreateSubscriptionModal
                visible={isModalVisible}
                onClose={() => setIsModalVisible(false)}
                onSubmit={handleCreateSubscription}
            />
        </SafeAreaView>
    );
}