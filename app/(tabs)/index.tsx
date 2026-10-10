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
import { useState, useMemo, useEffect } from "react";
import { useUser } from '@clerk/expo';
import { posthogLog } from '../../lib/posthog';
import { usePostHog } from 'posthog-react-native';
import { useSubscriptionStore } from "../../lib/subscriptionStore";

const SafeAreaView = styled(RNSafeAreaView);

export default function App() {
    const { user } = useUser();
    const posthog = usePostHog();

    const [expandedSubscriptionId, setExpandedSubscriptionId] = useState<string | null>(null);
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [editingSub, setEditingSub] = useState<Subscription | null>(null);

    const { 
        subscriptions, 
        addSubscription, 
        updateSubscription, 
        rolloverExpiredRenewals 
    } = useSubscriptionStore();

    useEffect(() => {
        rolloverExpiredRenewals();
    }, []);

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

    const { monthlySpend, primaryCurrency, nextRenewalDate } = useMemo(() => {
        if (!subscriptions || subscriptions.length === 0) {
            return { monthlySpend: 0, primaryCurrency: 'INR', nextRenewalDate: null };
        }

        let total = 0;
        let currency = 'INR';

        subscriptions.forEach((sub) => {
            if (sub.currency) currency = sub.currency;
            if (sub.status !== 'active') return;

            const freq = sub.frequency || sub.billing;
            if (freq === 'Yearly') total += sub.price / 12;
            else if (freq === 'Quarterly') total += sub.price / 3;
            else total += sub.price;
        });

        const nextDate = upcomingSubscriptions[0]?.renewalDate || null;

        return {
            monthlySpend: total,
            primaryCurrency: currency,
            nextRenewalDate: nextDate,
        };
    }, [subscriptions, upcomingSubscriptions]);

    const handleCreateOrUpdateSubscription = (subData: Subscription) => {
        if (editingSub) {
            updateSubscription(subData.id, subData);
            setEditingSub(null);
        } else {
            addSubscription(subData);
            posthog?.capture('subscription_created', {
                subscription_name: subData.name,
                subscription_price: subData.price,
                subscription_currency: subData.currency,
                subscription_frequency: subData.frequency,
                subscription_category: subData.category,
            });
        }
        setIsCreateModalVisible(false);
    };

    const displayName = user?.firstName || user?.fullName || user?.emailAddresses[0]?.emailAddress || 'User';

    return (
        <SafeAreaView className="flex-1 bg-background">
            <FlatList 
                ListHeaderComponent={() => (
                    <>
                        {/* Header Bar */}
                        <View className="flex-row items-center justify-between mb-4">
                            <View className="flex-row items-center flex-1 min-w-0 pr-3">
                                <Image
                                    source={user?.imageUrl ? { uri: user.imageUrl } : images.avatar}
                                    className="size-12 rounded-full border border-black/10 shrink-0"
                                />
                                <View className="ml-3 flex-1 min-w-0">
                                    <Text className="text-xs font-sans-medium text-muted-foreground">Welcome back,</Text>
                                    <Text className="text-lg font-sans-bold text-primary" numberOfLines={1}>
                                        {displayName}
                                    </Text>
                                </View>
                            </View>
                            <Pressable 
                                onPress={() => {
                                    setEditingSub(null);
                                    setIsCreateModalVisible(true);
                                }}
                                className="size-11 rounded-2xl bg-card border border-border items-center justify-center active:opacity-70 shadow-xs shrink-0"
                            >
                                <Image source={icons.add} className="size-7" />
                            </Pressable>
                        </View>

                        {/* Responsive Balance Card */}
                        <View className="rounded-3xl bg-accent p-5 mb-5 shadow-sm">
                            <Text className="text-xs font-sans-semibold text-white/80 uppercase tracking-wider">
                                Total Monthly Spend
                            </Text>

                            <View className="flex-row items-end justify-between mt-2 flex-wrap gap-2">
                                <Text 
                                    className="text-3xl sm:text-4xl font-sans-extrabold text-white flex-1 min-w-[140px]"
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                >
                                    {formatCurrency(monthlySpend, primaryCurrency)}
                                </Text>

                                <View className="bg-white/20 px-3 py-1.5 rounded-xl border border-white/10 shrink-0">
                                    <Text className="text-xs font-sans-bold text-white">
                                        {nextRenewalDate 
                                            ? `Next: ${dayjs(nextRenewalDate).format('DD MMM')}` 
                                            : 'No renewals'}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Upcoming Renewals Carousel */}
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
                                contentContainerStyle={{ gap: 12, paddingRight: 4 }}
                                ListEmptyComponent={
                                    <View className="py-4">
                                        <Text className="text-sm font-sans-medium text-muted-foreground">
                                            No renewals scheduled in the next 30 days.
                                        </Text>
                                    </View>
                                }
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
                        onEdit={() => {
                            setEditingSub(item);
                            setIsCreateModalVisible(true);
                        }}
                    />
                )}
                extraData={expandedSubscriptionId}
                ItemSeparatorComponent={() => <View className="h-3" />}
                ListEmptyComponent={
                    <View className="items-center py-6">
                        <Text className="text-sm font-sans-medium text-muted-foreground">
                            No subscriptions added yet. Tap + to add one.
                        </Text>
                    </View>
                }
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 130 }}
            />

            <CreateSubscriptionModal
                visible={isCreateModalVisible}
                initialData={editingSub}
                onClose={() => {
                    setIsCreateModalVisible(false);
                    setEditingSub(null);
                }}
                onSubmit={handleCreateOrUpdateSubscription}
            />
        </SafeAreaView>
    );
}