import { View, Text, ScrollView, Pressable, Image } from 'react-native';
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";
import { styled } from "nativewind";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import dayjs from "dayjs";
import { useSubscriptionStore } from "../../lib/subscriptionStore";
import { formatCurrency } from "../../lib/utils";

const SafeAreaView = styled(RNSafeAreaView);

// Fallback pastel palette matching Claude (yellow), Canva (mint), and Grammarly (periwinkle)
const CARD_PALETTE = ['#f5c542', '#8fd1bd', '#9bbce6', '#ff9f7a', '#c3b1e1'];

// Bar chart data for the weekly upcoming view
const WEEK_DATA = [
  { day: 'Mon', amount: 36, label: '$36' },
  { day: 'Tue', amount: 30, label: '$30' },
  { day: 'Wed', amount: 22, label: '$22' },
  { day: 'Thr', amount: 40, label: '$40', active: true },
  { day: 'Fri', amount: 34, label: '$34' },
  { day: 'Sat', amount: 20, label: '$20' },
  { day: 'Sun', amount: 24, label: '$24' },
];

const Insights = () => {
  const router = useRouter();
  const { subscriptions } = useSubscriptionStore();
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(3); // Default to Thursday

  // Calculate monthly total expenses dynamically from subscriptions
  const totalMonthlyExpenses = useMemo(() => {
    if (!subscriptions || subscriptions.length === 0) return 424.63;
    return subscriptions.reduce((sum, sub) => {
      const isYearly = sub.frequency === 'Yearly' || sub.billing?.toLowerCase() === 'yearly';
      const monthly = isYearly ? sub.price / 12 : sub.price;
      return sum + monthly;
    }, 0);
  }, [subscriptions]);

  const maxChartValue = 45;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 130 }}
      >
        {/* Top Navigation Bar */}
        <View className="flex-row items-center justify-between mb-6">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : null)}
            className="size-12 rounded-full border border-black/15 bg-white/40 items-center justify-center active:opacity-70"
          >
            <Text className="text-2xl font-sans-bold text-primary -mt-1">‹</Text>
          </Pressable>

          <Text className="text-2xl font-sans-bold text-primary">Monthly Insights</Text>

          <Pressable className="size-12 rounded-full border border-black/15 bg-white/40 items-center justify-center active:opacity-70">
            <Text className="text-sm font-sans-bold text-primary tracking-widest">•••</Text>
          </Pressable>
        </View>

        {/* Section 1: Upcoming Bar Chart */}
        <View className="list-head">
          <Text className="list-title">Upcoming</Text>
          <Pressable className="list-action">
            <Text className="list-action-text">View all</Text>
          </Pressable>
        </View>

        {/* Custom Weekly Bar Chart Card */}
        <View className="rounded-3xl bg-[#f8edd1] border border-black/5 p-5 mb-5 relative">
          {/* Dashed Horizontal Grid Lines */}
          <View className="h-44 w-full justify-between absolute top-5 left-5 right-5 pointer-events-none">
            {[45, 35, 25, 5, 0].map((val) => (
              <View key={val} className="flex-row items-center w-full">
                <Text className="text-[11px] font-sans-medium text-black/40 w-6">{val}</Text>
                <View className="flex-1 border-b border-dashed border-black/15 ml-2" />
              </View>
            ))}
          </View>

          {/* Bars Row */}
          <View className="h-44 flex-row items-end pl-8 pr-1 mb-2">
            {WEEK_DATA.map((item, index) => {
              const isSelected = selectedDayIndex === index;
              const barHeightPercent = Math.min((item.amount / maxChartValue) * 100, 100);

              return (
                <Pressable
                  key={item.day}
                  onPress={() => setSelectedDayIndex(index)}
                  className="flex-1 items-center justify-end h-full"
                >
                  {/* Tooltip on Active/Selected Day */}
                  {isSelected && (
                    <View className="items-center mb-1.5 z-10">
                      <View className="bg-white px-2.5 py-1 rounded-xl shadow-sm border border-black/5">
                        <Text className="text-xs font-sans-bold text-accent">{item.label}</Text>
                      </View>
                      {/* Triangle Arrow */}
                      <View className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-white -mt-0.5" />
                    </View>
                  )}

                  {/* Vertical Pill Bar */}
                  <View
                    style={{ height: `${barHeightPercent}%` }}
                    className={`w-3.5 rounded-full ${isSelected ? 'bg-accent' : 'bg-primary'}`}
                  />
                </Pressable>
              );
            })}
          </View>

          {/* Weekday Labels */}
          <View className="flex-row items-center pl-8 pr-1 mt-2">
            {WEEK_DATA.map((item, index) => (
              <View key={item.day} className="flex-1 items-center">
                <Text
                  className={`text-xs font-sans-medium ${
                    selectedDayIndex === index ? 'font-sans-bold text-accent' : 'text-muted-foreground'
                  }`}
                >
                  {item.day}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Section 2: Expenses Summary Card */}
        <View className="bg-card rounded-3xl p-5 border border-border flex-row items-center justify-between mb-5 shadow-sm">
          <View>
            <Text className="text-xl font-sans-bold text-primary">Expenses</Text>
            <Text className="text-sm font-sans-medium text-muted-foreground mt-1">
              {dayjs().format('MMMM YYYY')}
            </Text>
          </View>

          <View className="items-end">
            <Text className="text-2xl font-sans-extrabold text-primary">
              -{formatCurrency(totalMonthlyExpenses)}
            </Text>
            <Text className="text-xs font-sans-bold text-muted-foreground mt-1">+12%</Text>
          </View>
        </View>

        {/* Section 3: History List */}
        <View className="list-head">
          <Text className="list-title">History</Text>
          <Pressable className="list-action">
            <Text className="list-action-text">View all</Text>
          </Pressable>
        </View>

        {/* History Subscription Cards */}
        {subscriptions.length === 0 ? (
          <View className="bg-card p-5 rounded-2xl items-center border border-border">
            <Text className="text-sm font-sans-medium text-muted-foreground">
              No subscription history yet.
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {subscriptions.map((sub, index) => {
              // Apply the card's category color or cycle through the pastel palette
              const cardBg = sub.color || CARD_PALETTE[index % CARD_PALETTE.length];
              const formattedDate = dayjs(sub.renewalDate || sub.startDate).format('MMMM D, HH:mm');

              return (
                <View
                  key={sub.id}
                  style={{ backgroundColor: cardBg }}
                  className="rounded-3xl p-4 flex-row items-center justify-between shadow-sm"
                >
                  {/* Left: Icon & Info */}
                  <View className="flex-row items-center gap-3.5 flex-1 min-w-0">
                    <View className="size-14 rounded-2xl bg-white/70 items-center justify-center shrink-0">
                      {sub.icon ? (
                        <Image source={sub.icon} className="size-8" resizeMode="contain" />
                      ) : (
                        <Text className="text-xl font-sans-extrabold text-primary">
                          {sub.name.charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>

                    <View className="flex-1 min-w-0">
                      <Text className="text-lg font-sans-bold text-primary" numberOfLines={1}>
                        {sub.name}
                      </Text>
                      <Text className="text-sm font-sans-medium text-primary/70 mt-0.5" numberOfLines={1}>
                        {formattedDate}
                      </Text>
                    </View>
                  </View>

                  {/* Right: Amount & Cadence */}
                  <View className="items-end shrink-0 ml-3">
                    <Text className="text-lg font-sans-extrabold text-primary">
                      {formatCurrency(sub.price)}
                    </Text>
                    <Text className="text-xs font-sans-medium text-primary/70 mt-0.5">
                      per {sub.frequency?.toLowerCase() === 'yearly' ? 'year' : 'month'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default Insights;