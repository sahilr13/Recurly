import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";
import { styled } from "nativewind";
import { useRouter } from "expo-router";
import { useMemo, useState, useEffect } from "react";
import dayjs from "dayjs";
import { useSubscriptionStore } from "../../lib/subscriptionStore";
import { formatCurrency } from "../../lib/utils";
import SubscriptionIcon from "../../components/SubscriptionIcon";

const SafeAreaView = styled(RNSafeAreaView);

// Card pastel palette matching the screenshot (Claude yellow, Canva mint, Grammarly periwinkle, etc.)
const CARD_PALETTE = ['#f5c542', '#8fd1bd', '#9bbce6', '#ff9f7a', '#c3b1e1'];

const Insights = () => {
  const router = useRouter();
  const { subscriptions } = useSubscriptionStore();

  // 1. Calculate normalized monthly spend, primary currency, and cadence metrics
  const { totalMonthly, primaryCurrency, frequencyBreakdown } = useMemo(() => {
    if (!subscriptions || subscriptions.length === 0) {
      return {
        totalMonthly: 0,
        primaryCurrency: 'INR',
        frequencyBreakdown: { monthly: 0, quarterly: 0, yearly: 0 },
      };
    }

    let monthlySum = 0;
    let currency = 'INR';
    let monthlyCount = 0;
    let quarterlyCount = 0;
    let yearlyCount = 0;

    subscriptions.forEach((sub) => {
      if (sub.currency) currency = sub.currency;

      const freq = sub.frequency || sub.billing;
      if (freq === 'Yearly') {
        monthlySum += sub.price / 12;
        yearlyCount += 1;
      } else if (freq === 'Quarterly') {
        monthlySum += sub.price / 3;
        quarterlyCount += 1;
      } else {
        monthlySum += sub.price;
        monthlyCount += 1;
      }
    });

    return {
      totalMonthly: monthlySum,
      primaryCurrency: currency,
      frequencyBreakdown: {
        monthly: monthlyCount,
        quarterly: quarterlyCount,
        yearly: yearlyCount,
      },
    };
  }, [subscriptions]);

  // 2. Generate Dynamic 7-Day Week Data based on current week (Mon -> Sun)
  const { weekChartData, maxChartValue, defaultDayIndex, gridSteps } = useMemo(() => {
    const today = dayjs().startOf('day');
    // Dayjs: 0 is Sunday, 1 is Monday... 6 is Saturday
    const currentDayOfWeek = today.day();
    const diffToMonday = (currentDayOfWeek + 6) % 7; // 0 for Mon, 1 for Tue, ..., 6 for Sun
    const monday = today.subtract(diffToMonday, 'day');

    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thr', 'Fri', 'Sat', 'Sun'];

    const chartDays = dayLabels.map((dayLabel, idx) => {
      const targetDate = monday.add(idx, 'day');
      const targetDateStr = targetDate.format('YYYY-MM-DD');

      // Sum active renewals due on this specific date
      const totalForDay = (subscriptions || []).reduce((acc, sub) => {
        if (sub.status !== 'active' || !sub.renewalDate) return acc;
        const subDateStr = dayjs(sub.renewalDate).format('YYYY-MM-DD');
        if (subDateStr === targetDateStr) {
          return acc + Number(sub.price || 0);
        }
        return acc;
      }, 0);

      return {
        day: dayLabel,
        dateStr: targetDateStr,
        amount: totalForDay,
        isToday: idx === diffToMonday,
      };
    });

    const highestAmount = Math.max(...chartDays.map((d) => d.amount), 0);
    // Determine dynamic ceiling for Y-axis (or default scale of 50 if all 0)
    const ceiling = highestAmount > 0 ? Math.ceil(highestAmount * 1.25) : 50;

    // Generate 5 horizontal grid points: ceiling, 75%, 50%, 25%, 0
    const steps = [
      ceiling,
      Math.round(ceiling * 0.75),
      Math.round(ceiling * 0.5),
      Math.round(ceiling * 0.25),
      0,
    ];

    return {
      weekChartData: chartDays,
      maxChartValue: ceiling,
      defaultDayIndex: diffToMonday,
      gridSteps: steps,
    };
  }, [subscriptions]);

  // State to track which day is selected/highlighted
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(defaultDayIndex);

  // Sync selected index whenever the week updates
  useEffect(() => {
    setSelectedDayIndex(defaultDayIndex);
  }, [defaultDayIndex]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 130 }}
      >
        {/* Navigation Bar */}
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

        <View className="rounded-3xl bg-[#f8edd1] border border-black/5 p-5 mb-5 relative">
          {/* Dashed Horizontal Grid Lines */}
          <View className="h-44 w-full justify-between absolute top-5 left-5 right-5 pointer-events-none">
            {gridSteps.map((val) => (
              <View key={val} className="flex-row items-center w-full">
                <Text className="text-[11px] font-sans-medium text-black/40 w-7">{val}</Text>
                <View className="flex-1 border-b border-dashed border-black/15 ml-1" />
              </View>
            ))}
          </View>

          {/* Bar Columns */}
          <View className="h-44 flex-row items-end pl-8 pr-1 mb-2">
            {weekChartData.map((item, index) => {
              const isSelected = selectedDayIndex === index;
              // Bar height calculation: If amount is 0, render a small 4px base indicator
              const hasAmount = item.amount > 0;
              const barHeightPercent = hasAmount
                ? Math.min((item.amount / maxChartValue) * 100, 100)
                : 0;

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
                        <Text className="text-xs font-sans-bold text-accent">
                          {formatCurrency(item.amount, primaryCurrency)}
                        </Text>
                      </View>
                      <View className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-white -mt-0.5" />
                    </View>
                  )}

                  {/* Vertical Bar */}
                  <View
                    style={{
                      height: hasAmount ? `${Math.max(barHeightPercent, 8)}%` : 5,
                    }}
                    className={`w-3.5 rounded-full ${
                      isSelected
                        ? 'bg-accent'
                        : hasAmount
                        ? 'bg-primary'
                        : 'bg-black/15'
                    }`}
                  />
                </Pressable>
              );
            })}
          </View>

          {/* Weekday Labels */}
          <View className="flex-row items-center pl-8 pr-1 mt-2">
            {weekChartData.map((item, index) => (
              <View key={item.day} className="flex-1 items-center">
                <Text
                  className={`text-xs ${
                    selectedDayIndex === index
                      ? 'font-sans-bold text-accent'
                      : item.isToday
                      ? 'font-sans-bold text-primary'
                      : 'font-sans-medium text-muted-foreground'
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
              -{formatCurrency(totalMonthly, primaryCurrency)}
            </Text>
            <Text className="text-xs font-sans-bold text-muted-foreground mt-1">+12%</Text>
          </View>
        </View>

        {/* Section 3: Billing Cadence Overview */}
        <View className="bg-card p-4 rounded-3xl border border-border flex-row justify-around mb-6 shadow-sm">
          <View className="items-center">
            <Text className="text-2xl font-sans-extrabold text-primary">
              {frequencyBreakdown.monthly}
            </Text>
            <Text className="text-xs font-sans-semibold text-muted-foreground mt-1">Monthly</Text>
          </View>
          <View className="w-[1px] bg-border" />
          <View className="items-center">
            <Text className="text-2xl font-sans-extrabold text-primary">
              {frequencyBreakdown.quarterly}
            </Text>
            <Text className="text-xs font-sans-semibold text-muted-foreground mt-1">Quarterly</Text>
          </View>
          <View className="w-[1px] bg-border" />
          <View className="items-center">
            <Text className="text-2xl font-sans-extrabold text-primary">
              {frequencyBreakdown.yearly}
            </Text>
            <Text className="text-xs font-sans-semibold text-muted-foreground mt-1">Yearly</Text>
          </View>
        </View>

        {/* Section 4: History List */}
        <View className="list-head">
          <Text className="list-title">History</Text>
          <Pressable className="list-action">
            <Text className="list-action-text">View all</Text>
          </Pressable>
        </View>

        {subscriptions.length === 0 ? (
          <View className="bg-card p-5 rounded-3xl items-center border border-border">
            <Text className="text-sm font-sans-medium text-muted-foreground">
              No subscription history yet.
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {subscriptions.map((sub, index) => {
              const cardBg = sub.color || CARD_PALETTE[index % CARD_PALETTE.length];
              const formattedDate = dayjs(sub.renewalDate || sub.startDate).format('MMMM D, HH:mm');
              const cadenceLabel =
                sub.frequency === 'Quarterly'
                  ? 'quarter'
                  : sub.frequency === 'Yearly'
                  ? 'year'
                  : 'month';

              return (
                <View
                  key={sub.id}
                  style={{ backgroundColor: cardBg }}
                  className="rounded-3xl p-4 flex-row items-center justify-between shadow-sm"
                >
                  {/* Left: Dynamic Icon & Information */}
                  <View className="flex-row items-center gap-3.5 flex-1 min-w-0">
                    <SubscriptionIcon
                      name={sub.name}
                      icon={sub.icon}
                      color={cardBg}
                      containerClassName="size-14 rounded-2xl bg-white/70 items-center justify-center shrink-0 overflow-hidden"
                      iconClassName="size-8"
                    />

                    <View className="flex-1 min-w-0">
                      <Text className="text-lg font-sans-bold text-primary" numberOfLines={1}>
                        {sub.name}
                      </Text>
                      <Text
                        className="text-sm font-sans-medium text-primary/70 mt-0.5"
                        numberOfLines={1}
                      >
                        {formattedDate}
                      </Text>
                    </View>
                  </View>

                  {/* Right: Price & Cadence */}
                  <View className="items-end shrink-0 ml-3">
                    <Text className="text-lg font-sans-extrabold text-primary">
                      {formatCurrency(sub.price, sub.currency)}
                    </Text>
                    <Text className="text-xs font-sans-medium text-primary/70 mt-0.5">
                      per {cadenceLabel}
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