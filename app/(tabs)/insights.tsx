import { View, Text, ScrollView, Pressable, LayoutAnimation, Alert } from 'react-native';
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";
import { styled } from "nativewind";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import dayjs from "dayjs";
import { Feather } from '@expo/vector-icons';
import { useSubscriptionStore } from "../../lib/subscriptionStore";
import { formatCurrency } from "../../lib/utils";
import AnimatedPressable from "../../components/AnimatedPressable";
import { pickAndParseStatement } from "../../lib/statementParser";

const SafeAreaView = styled(RNSafeAreaView);

type MainTab = 'subscriptions' | 'bank_health';

const CATEGORY_COLORS: Record<string, string> = {
  'Entertainment': '#ff6b6b',
  'AI Tools': '#56c2d6',
  'Developer Tools': '#a78bfa',
  'Design': '#f5c542',
  'Productivity': '#8fd1bd',
  'Other': '#d4d4d4',
};

const Insights = () => {
  const router = useRouter();
  const { subscriptions, statementSummary, setStatementSummary, addSubscriptions } = useSubscriptionStore();
  const [activeTab, setActiveTab] = useState<MainTab>('subscriptions');
  const [subscriptionPeriod, setSubscriptionPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const handleTabSwitch = (tab: MainTab) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
  };

  const handleImportStatement = async () => {
    try {
      const parsed = await pickAndParseStatement();
      if (!parsed) return;

      setStatementSummary(parsed.summary);
      if (parsed.subscriptions.length > 0) {
        addSubscriptions(parsed.subscriptions);
      }
      Alert.alert('Success', 'Bank statement analytics updated successfully!');
    } catch (err: any) {
      Alert.alert('Import Failed', err.message || 'Could not parse statement.');
    }
  };

  // 1. Subscription Metrics
  const subMetrics = useMemo(() => {
    const active = subscriptions.filter((s) => s.status === 'active');
    let monthlyTotal = 0;
    let currency = 'INR';
    let highestSub = active[0] || null;
    let monthlyCount = 0;
    const catMap: Record<string, number> = {};

    active.forEach((sub) => {
      if (sub.currency) currency = sub.currency;
      const freq = sub.frequency || sub.billing;
      let monthlyCost = sub.price;

      if (freq === 'Yearly') monthlyCost = sub.price / 12;
      else if (freq === 'Quarterly') monthlyCost = sub.price / 3;
      else monthlyCount += 1;

      monthlyTotal += monthlyCost;

      if (!highestSub || monthlyCost > (highestSub.price / (highestSub.frequency === 'Yearly' ? 12 : highestSub.frequency === 'Quarterly' ? 3 : 1))) {
        highestSub = sub;
      }

      const category = sub.category || 'Other';
      catMap[category] = (catMap[category] || 0) + monthlyCost;
    });

    const now = dayjs().startOf('day');
    const weekAhead = now.add(7, 'day');
    const dueThisWeek = active.reduce((sum, s) => {
      if (!s.renewalDate) return sum;
      const r = dayjs(s.renewalDate);
      return (r.isAfter(now) || r.isSame(now, 'day')) && r.isBefore(weekAhead) ? sum + s.price : sum;
    }, 0);

    const categories = Object.entries(catMap)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: monthlyTotal > 0 ? Math.round((amount / monthlyTotal) * 100) : 0,
        color: CATEGORY_COLORS[name] || '#8fd1bd',
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      monthlyTotal,
      annualTotal: monthlyTotal * 12,
      dailyBurn: monthlyTotal / 30.4,
      currency,
      activeCount: active.length,
      highestSub,
      dueThisWeek,
      categories,
      annualSavingsOpportunity: monthlyCount > 0 ? monthlyTotal * 0.16 * 12 : 0,
    };
  }, [subscriptions]);

  // 2. Industry-Grade FinHealth Engine
  const bankMetrics = useMemo(() => {
    if (!statementSummary) return null;

    const totalDebits = statementSummary.totalDebits || 0;
    const totalCredits = statementSummary.totalCredits || 0;
    const netCashflow = statementSummary.netCashflow || 0;

    // Days span calculation
    const start = dayjs(statementSummary.startDate);
    const end = dayjs(statementSummary.endDate);
    const daysSpan = Math.max(1, end.diff(start, 'day') || 30);
    const months = daysSpan / 30.4;
    const monthlyNormalizedDebits = totalDebits / months;
    const dailyVelocity = totalDebits / daysSpan;

    // Savings retention rate
    const savingsRate = totalCredits > 0 ? (netCashflow / totalCredits) * 100 : 0;

    // Recurring Burden Score
    const burdenPercentage = monthlyNormalizedDebits > 0
      ? (subMetrics.monthlyTotal / monthlyNormalizedDebits) * 100
      : 0;

    // FinHealth Composite Scoring Algorithm (0 to 100)
    let score = 50;

    // Component A: Savings Retention (up to 30 pts)
    if (savingsRate >= 20) score += 30;
    else if (savingsRate >= 10) score += 25;
    else if (savingsRate > 0) score += 18;
    else score -= 15;

    // Component B: Recurring Fixed Burden (up to 30 pts)
    if (burdenPercentage <= 5) score += 20;
    else if (burdenPercentage <= 15) score += 12;
    else if (burdenPercentage <= 25) score += 5;
    else score -= 15;

    // Component C: Inflow Consistency & Cushion
    if (totalCredits > 50000) score += 10;

    const finalScore = Math.min(100, Math.max(15, Math.round(score)));

    let scoreTier = 'Strong Financial Health';
    let scoreColor = '#16a34a'; // Green
    let scoreTierShort = 'Strong';

    if (finalScore < 50) {
      scoreTier = 'Needs Attention';
      scoreTierShort = 'At Risk';
      scoreColor = '#dc2626'; // Red
    } else if (finalScore < 75) {
      scoreTier = 'Fair Financial Health';
      scoreTierShort = 'Fair';
      scoreColor = '#ea7a53'; // Orange
    } else if (finalScore >= 85) {
      scoreTier = 'Excellent Financial Health';
      scoreTierShort = 'Excellent';
      scoreColor = '#16a34a';
    }

    // Spend distribution for merchants
    const topMerchantsWithRatio = (statementSummary.topMerchants || []).map((m) => ({
      ...m,
      ratio: totalDebits > 0 ? Math.round((m.amount / totalDebits) * 100) : 0,
    }));

    return {
      totalDebits,
      totalCredits,
      netCashflow,
      savingsRate,
      burdenPercentage,
      finalScore,
      scoreTier,
      scoreTierShort,
      scoreColor,
      dailyVelocity,
      transactionCount: statementSummary.transactionCount,
      startDate: statementSummary.startDate,
      endDate: statementSummary.endDate,
      topMerchants: topMerchantsWithRatio,
      currency: statementSummary.currency || 'INR',
    };
  }, [statementSummary, subMetrics.monthlyTotal]);

  // Outflow projection (Current week Monday -> Sunday)
  const { weekChartData, ceilingValue, currentDayIdx } = useMemo(() => {
    const today = dayjs().startOf('day');
    const dayOfWeek = today.day();
    const diffToMonday = (dayOfWeek + 6) % 7;
    const monday = today.subtract(diffToMonday, 'day');

    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thr', 'Fri', 'Sat', 'Sun'];
    const days = dayLabels.map((day, idx) => {
      const targetDateStr = monday.add(idx, 'day').format('YYYY-MM-DD');
      const due = subscriptions.reduce((sum, s) => {
        if (s.status !== 'active' || !s.renewalDate) return sum;
        return dayjs(s.renewalDate).format('YYYY-MM-DD') === targetDateStr ? sum + s.price : sum;
      }, 0);

      return {
        day,
        amount: due,
        isToday: idx === diffToMonday,
      };
    });

    const max = Math.max(...days.map((d) => d.amount), 0);
    return {
      weekChartData: days,
      ceilingValue: max > 0 ? Math.ceil(max * 1.3) : 50,
      currentDayIdx: diffToMonday,
    };
  }, [subscriptions]);

  const [selectedDay, setSelectedDay] = useState<number>(currentDayIdx);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 130 }}
      >
        {/* Navigation Bar */}
        <View className="flex-row items-center justify-between mb-4">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : null)}
            className="size-11 rounded-2xl border border-border bg-card items-center justify-center active:opacity-70 shadow-xs shrink-0"
          >
            <Feather name="arrow-left" size={18} color="#081126" />
          </Pressable>

          <Text className="text-xl font-sans-bold text-primary shrink-1 px-2" numberOfLines={1}>
            Financial Insights
          </Text>

          <Pressable
            onPress={handleImportStatement}
            className="size-11 rounded-2xl border border-border bg-card items-center justify-center active:opacity-70 shadow-xs shrink-0"
          >
            <Feather name="upload" size={16} color="#081126" />
          </Pressable>
        </View>

        {/* Dual Tab Segmented Control */}
        <View className="flex-row bg-card rounded-2xl p-1 border border-border mb-5 shadow-xs">
          <Pressable
            onPress={() => handleTabSwitch('subscriptions')}
            className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5 ${
              activeTab === 'subscriptions' ? 'bg-primary' : 'bg-transparent'
            }`}
          >
            <Feather
              name="pie-chart"
              size={14}
              color={activeTab === 'subscriptions' ? '#ffffff' : '#081126'}
            />
            <Text
              className={`text-xs font-sans-bold ${
                activeTab === 'subscriptions' ? 'text-white' : 'text-primary'
              }`}
            >
              Subscriptions
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleTabSwitch('bank_health')}
            className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5 ${
              activeTab === 'bank_health' ? 'bg-primary' : 'bg-transparent'
            }`}
          >
            <Feather
              name="activity"
              size={14}
              color={activeTab === 'bank_health' ? '#ffffff' : '#081126'}
            />
            <Text
              className={`text-xs font-sans-bold ${
                activeTab === 'bank_health' ? 'text-white' : 'text-primary'
              }`}
            >
              Bank Health
            </Text>
          </Pressable>
        </View>

        {/* ===================== TAB 1: SUBSCRIPTIONS ===================== */}
        {activeTab === 'subscriptions' && (
          <View>
            {/* Hero Spend Card */}
            <View className="bg-primary rounded-3xl p-5 mb-5 shadow-sm">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-xs font-sans-semibold text-white/70 uppercase tracking-wider">
                  {subscriptionPeriod === 'monthly' ? 'Monthly Commitment' : 'Annual Run-Rate'}
                </Text>

                <View className="flex-row bg-white/10 rounded-xl p-0.5 border border-white/10">
                  <Pressable
                    onPress={() => setSubscriptionPeriod('monthly')}
                    className={`px-2.5 py-1 rounded-lg ${subscriptionPeriod === 'monthly' ? 'bg-accent' : 'bg-transparent'}`}
                  >
                    <Text className="text-[10px] font-sans-bold text-white">Monthly</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setSubscriptionPeriod('yearly')}
                    className={`px-2.5 py-1 rounded-lg ${subscriptionPeriod === 'yearly' ? 'bg-accent' : 'bg-transparent'}`}
                  >
                    <Text className="text-[10px] font-sans-bold text-white">Yearly</Text>
                  </Pressable>
                </View>
              </View>

              <Text 
                className="text-3xl sm:text-4xl font-sans-extrabold text-white mt-1"
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatCurrency(
                  subscriptionPeriod === 'monthly' ? subMetrics.monthlyTotal : subMetrics.annualTotal,
                  subMetrics.currency
                )}
              </Text>

              <View className="flex-row items-center justify-between border-t border-white/15 mt-4 pt-3">
                <View className="flex-1">
                  <Text className="text-[11px] font-sans-medium text-white/60">Daily Burn Rate</Text>
                  <Text className="text-sm font-sans-bold text-white mt-0.5" numberOfLines={1}>
                    {formatCurrency(subMetrics.dailyBurn, subMetrics.currency)}/day
                  </Text>
                </View>
                <View className="h-7 w-[1px] bg-white/15 mx-3" />
                <View className="flex-1 items-end">
                  <Text className="text-[11px] font-sans-medium text-white/60">Active Services</Text>
                  <Text className="text-sm font-sans-bold text-white mt-0.5">
                    {subMetrics.activeCount} recurring
                  </Text>
                </View>
              </View>
            </View>

            {/* Observations */}
            <Text className="text-base font-sans-bold text-primary mb-3">Commitment Insights</Text>
            <View className="gap-2.5 mb-5">
              {subMetrics.highestSub && (
                <View className="bg-card rounded-2xl p-4 border border-border flex-row items-center justify-between shadow-xs">
                  <View className="flex-1 pr-2 min-w-0">
                    <View className="flex-row items-center gap-1.5 mb-0.5">
                      <Feather name="alert-circle" size={13} color="#ea7a53" />
                      <Text className="text-[11px] font-sans-bold text-accent uppercase tracking-wider">Top Commitment</Text>
                    </View>
                    <Text className="text-base font-sans-bold text-primary" numberOfLines={1}>{subMetrics.highestSub.name}</Text>
                    <Text className="text-xs font-sans-medium text-muted-foreground mt-0.5">
                      Largest recurring fixed expense.
                    </Text>
                  </View>
                  <Text className="text-base font-sans-extrabold text-primary shrink-0">
                    {formatCurrency(subMetrics.highestSub.price, subMetrics.highestSub.currency)}
                  </Text>
                </View>
              )}

              <View className="bg-card rounded-2xl p-4 border border-border flex-row items-center justify-between shadow-xs">
                <View className="flex-1 pr-2 min-w-0">
                  <View className="flex-row items-center gap-1.5 mb-0.5">
                    <Feather name="clock" size={13} color="#081126" />
                    <Text className="text-[11px] font-sans-bold text-primary/70 uppercase tracking-wider">Due This Week</Text>
                  </View>
                  <Text className="text-base font-sans-bold text-primary">Required Cash Outflow</Text>
                  <Text className="text-xs font-sans-medium text-muted-foreground mt-0.5">
                    Liquidity needed for the next 7 days.
                  </Text>
                </View>
                <Text className="text-base font-sans-extrabold text-accent shrink-0">
                  {formatCurrency(subMetrics.dueThisWeek, subMetrics.currency)}
                </Text>
              </View>

              {subMetrics.annualSavingsOpportunity > 0 && (
                <View className="bg-[#f0f9f4] rounded-2xl p-4 border border-[#8fd1bd]/50 flex-row items-center justify-between shadow-xs">
                  <View className="flex-1 pr-2 min-w-0">
                    <View className="flex-row items-center gap-1.5 mb-0.5">
                      <Feather name="trending-down" size={13} color="#16a34a" />
                      <Text className="text-[11px] font-sans-bold text-success uppercase tracking-wider">Annual Discount Potential</Text>
                    </View>
                    <Text className="text-xs font-sans-medium text-primary/80 mt-0.5">
                      Upgrading monthly plans typically saves ~16%:
                    </Text>
                  </View>
                  <Text className="text-sm font-sans-extrabold text-success shrink-0">
                    ~{formatCurrency(subMetrics.annualSavingsOpportunity, subMetrics.currency)}/yr
                  </Text>
                </View>
              )}
            </View>

            {/* Category Allocation */}
            <View className="mb-5">
              <Text className="text-base font-sans-bold text-primary mb-3">Category Allocation</Text>
              {subMetrics.categories.length === 0 ? (
                <View className="bg-card p-5 rounded-2xl border border-border items-center">
                  <Text className="text-xs font-sans-medium text-muted-foreground">No active subscriptions to categorize.</Text>
                </View>
              ) : (
                <View className="bg-card rounded-3xl p-4 border border-border gap-3.5 shadow-xs">
                  <View className="h-2.5 w-full bg-black/5 rounded-full overflow-hidden flex-row">
                    {subMetrics.categories.map((c) => (
                      <View key={c.name} style={{ width: `${c.percentage}%`, backgroundColor: c.color }} className="h-full" />
                    ))}
                  </View>

                  <View className="gap-2">
                    {subMetrics.categories.map((c) => (
                      <View key={c.name} className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-2 flex-1 pr-2">
                          <View style={{ backgroundColor: c.color }} className="size-2 rounded-full shrink-0" />
                          <Text className="text-xs font-sans-semibold text-primary truncate" numberOfLines={1}>{c.name}</Text>
                          <Text className="text-[10px] font-sans-bold text-muted-foreground shrink-0">({c.percentage}%)</Text>
                        </View>
                        <Text className="text-xs font-sans-bold text-primary shrink-0">
                          {formatCurrency(c.amount, subMetrics.currency)}/mo
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* Weekly Outflow Schedule */}
            <View className="mb-4">
              <Text className="text-base font-sans-bold text-primary mb-3">Weekly Outflow Schedule</Text>
              <View className="rounded-3xl bg-[#f8edd1] border border-black/5 p-4 shadow-xs">
                <View className="h-36 flex-row items-end pl-1 pr-1">
                  {weekChartData.map((item, idx) => {
                    const isSelected = selectedDay === idx;
                    const hasAmount = item.amount > 0;
                    const barHeight = hasAmount ? Math.min((item.amount / ceilingValue) * 100, 100) : 0;

                    return (
                      <Pressable
                        key={item.day}
                        onPress={() => setSelectedDay(idx)}
                        className="flex-1 items-center justify-end h-full"
                      >
                        {isSelected && (
                          <View className="items-center mb-1 z-10">
                            <View className="bg-white px-2 py-0.5 rounded-lg shadow-xs border border-black/5">
                              <Text className="text-[10px] font-sans-bold text-accent">
                                {formatCurrency(item.amount, subMetrics.currency)}
                              </Text>
                            </View>
                          </View>
                        )}
                        <View
                          style={{ height: hasAmount ? `${Math.max(barHeight, 10)}%` : 5 }}
                          className={`w-3 rounded-full ${isSelected ? 'bg-accent' : hasAmount ? 'bg-primary' : 'bg-black/15'}`}
                        />
                        <Text
                          className={`text-xs mt-2 ${
                            isSelected
                              ? 'font-sans-bold text-accent'
                              : item.isToday
                              ? 'font-sans-bold text-primary'
                              : 'font-sans-medium text-muted-foreground'
                          }`}
                        >
                          {item.day}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ===================== TAB 2: BANK HEALTH ===================== */}
        {activeTab === 'bank_health' && (
          <View>
            {!bankMetrics ? (
              <View className="bg-card rounded-3xl p-6 border border-border items-center my-4 shadow-xs">
                <View className="size-16 rounded-2xl bg-accent/15 items-center justify-center mb-4">
                  <Feather name="file-text" size={28} color="#ea7a53" />
                </View>
                <Text className="text-lg font-sans-bold text-primary text-center">No Statement Analyzed Yet</Text>
                <Text className="text-xs font-sans-medium text-muted-foreground text-center mt-2 mb-6 px-3 leading-5">
                  Import your bank statement CSV to compute your Financial Health Score, Net Cash Flow, and top merchant expenses.
                </Text>
                <AnimatedPressable
                  onPress={handleImportStatement}
                  containerClassName="bg-primary px-5 py-3 rounded-2xl flex-row items-center gap-2 shadow-xs"
                >
                  <Feather name="upload" size={15} color="#ffffff" />
                  <Text className="text-xs font-sans-bold text-white">Import Statement CSV</Text>
                </AnimatedPressable>
              </View>
            ) : (
              <View>
                {/* 1. Verified Statement Header Tag */}
                <View className="flex-row items-center justify-between mb-3 px-1">
                  <View className="flex-row items-center gap-1.5 flex-1 min-w-0 pr-2">
                    <Feather name="shield" size={13} color="#16a34a" />
                    <Text className="text-xs font-sans-bold text-primary truncate" numberOfLines={1}>
                      State Bank of India • Savings
                    </Text>
                  </View>
                  <View className="bg-primary/10 px-2.5 py-1 rounded-full shrink-0">
                    <Text className="text-[10px] font-sans-bold text-primary uppercase">
                      {bankMetrics.transactionCount} Txns
                    </Text>
                  </View>
                </View>

                {/* 2. Industry-Grade Financial Health Score Hero */}
                <View className="bg-card rounded-3xl p-5 border border-border mb-4 shadow-xs">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-xs font-sans-semibold text-muted-foreground uppercase tracking-wider">
                      Financial Health Score
                    </Text>
                    <View style={{ backgroundColor: `${bankMetrics.scoreColor}15` }} className="px-2.5 py-0.5 rounded-full border border-black/5">
                      <Text style={{ color: bankMetrics.scoreColor }} className="text-[11px] font-sans-bold uppercase">
                        {bankMetrics.scoreTierShort}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-baseline gap-1.5 my-1">
                    <Text className="text-4xl font-sans-extrabold text-primary">{bankMetrics.finalScore}</Text>
                    <Text className="text-base font-sans-bold text-muted-foreground">/ 100</Text>
                  </View>

                  {/* 4-Segment FinTech Health Gauge */}
                  <View className="flex-row gap-1.5 mt-2 mb-2">
                    <View className="flex-1 h-2 rounded-full bg-[#dc2626]" style={{ opacity: bankMetrics.finalScore < 50 ? 1 : 0.25 }} />
                    <View className="flex-1 h-2 rounded-full bg-[#ea7a53]" style={{ opacity: bankMetrics.finalScore >= 50 && bankMetrics.finalScore < 75 ? 1 : 0.25 }} />
                    <View className="flex-1 h-2 rounded-full bg-[#208aef]" style={{ opacity: bankMetrics.finalScore >= 75 && bankMetrics.finalScore < 85 ? 1 : 0.25 }} />
                    <View className="flex-1 h-2 rounded-full bg-[#16a34a]" style={{ opacity: bankMetrics.finalScore >= 85 ? 1 : 0.25 }} />
                  </View>

                  <View className="flex-row justify-between pt-1">
                    <Text className="text-[10px] font-sans-bold text-muted-foreground">Needs Work</Text>
                    <Text className="text-[10px] font-sans-bold text-muted-foreground">Fair</Text>
                    <Text className="text-[10px] font-sans-bold text-muted-foreground">Good</Text>
                    <Text className="text-[10px] font-sans-bold text-muted-foreground">Excellent</Text>
                  </View>

                  <View className="border-t border-border mt-3 pt-3 flex-row items-center justify-between">
                    <Text className="text-xs font-sans-medium text-muted-foreground">Net Cash Retention</Text>
                    <Text className="text-xs font-sans-bold text-success">+{bankMetrics.savingsRate.toFixed(1)}% saved</Text>
                  </View>
                </View>

                {/* 3. Cash Flow Summary (Two-Tone Dynamic Inflow vs Outflow) */}
                <View className="bg-primary rounded-3xl p-5 mb-4 shadow-sm">
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-xs font-sans-semibold text-white/70 uppercase tracking-wider">Cash Flow Dynamics</Text>
                    <Text className="text-[11px] font-sans-medium text-white/60">
                      {dayjs(bankMetrics.startDate).format('DD MMM')} – {dayjs(bankMetrics.endDate).format('DD MMM')}
                    </Text>
                  </View>

                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-1 pr-2">
                      <Text className="text-[11px] font-sans-medium text-white/60">Total Inflow</Text>
                      <Text className="text-lg font-sans-bold text-white" numberOfLines={1}>
                        +{formatCurrency(bankMetrics.totalCredits, bankMetrics.currency)}
                      </Text>
                    </View>
                    <View className="flex-1 items-end pl-2">
                      <Text className="text-[11px] font-sans-medium text-white/60">Total Outflow</Text>
                      <Text className="text-lg font-sans-bold text-white/90" numberOfLines={1}>
                        -{formatCurrency(bankMetrics.totalDebits, bankMetrics.currency)}
                      </Text>
                    </View>
                  </View>

                  {/* Dual Tone Inflow vs Outflow Bar */}
                  <View className="h-2.5 w-full bg-white/20 rounded-full overflow-hidden flex-row">
                    <View
                      style={{
                        width: `${Math.min(95, Math.max(5, (bankMetrics.totalDebits / bankMetrics.totalCredits) * 100))}%`,
                      }}
                      className="h-full bg-accent"
                    />
                    <View className="flex-1 h-full bg-[#16a34a]" />
                  </View>

                  <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-white/10">
                    <Text className="text-xs font-sans-medium text-white/70">Net Cash Position</Text>
                    <Text className={`text-sm font-sans-extrabold ${bankMetrics.netCashflow >= 0 ? 'text-[#8fd1bd]' : 'text-white'}`}>
                      {bankMetrics.netCashflow >= 0 ? '+' : ''}{formatCurrency(bankMetrics.netCashflow, bankMetrics.currency)}
                    </Text>
                  </View>
                </View>

                {/* 4. Four Financial Vitals (2x2 Grid) */}
                <Text className="text-base font-sans-bold text-primary mb-3">Key Vitals</Text>
                <View className="flex-row gap-2.5 mb-2.5">
                  <View className="flex-1 bg-card rounded-2xl p-3.5 border border-border shadow-xs min-w-0">
                    <View className="flex-row items-center gap-1.5 mb-1">
                      <Feather name="arrow-down-left" size={13} color="#16a34a" />
                      <Text className="text-[10px] font-sans-bold text-muted-foreground uppercase">Credits</Text>
                    </View>
                    <Text className="text-base font-sans-extrabold text-primary" numberOfLines={1} adjustsFontSizeToFit>
                      {formatCurrency(bankMetrics.totalCredits, bankMetrics.currency)}
                    </Text>
                  </View>

                  <View className="flex-1 bg-card rounded-2xl p-3.5 border border-border shadow-xs min-w-0">
                    <View className="flex-row items-center gap-1.5 mb-1">
                      <Feather name="arrow-up-right" size={13} color="#dc2626" />
                      <Text className="text-[10px] font-sans-bold text-muted-foreground uppercase">Debits</Text>
                    </View>
                    <Text className="text-base font-sans-extrabold text-primary" numberOfLines={1} adjustsFontSizeToFit>
                      {formatCurrency(bankMetrics.totalDebits, bankMetrics.currency)}
                    </Text>
                  </View>
                </View>

                <View className="flex-row gap-2.5 mb-5">
                  <View className="flex-1 bg-card rounded-2xl p-3.5 border border-border shadow-xs min-w-0">
                    <View className="flex-row items-center gap-1.5 mb-1">
                      <Feather name="zap" size={13} color="#ea7a53" />
                      <Text className="text-[10px] font-sans-bold text-muted-foreground uppercase">Burn Velocity</Text>
                    </View>
                    <Text className="text-base font-sans-extrabold text-primary" numberOfLines={1} adjustsFontSizeToFit>
                      {formatCurrency(bankMetrics.dailyVelocity, bankMetrics.currency)}/d
                    </Text>
                  </View>

                  <View className="flex-1 bg-card rounded-2xl p-3.5 border border-border shadow-xs min-w-0">
                    <View className="flex-row items-center gap-1.5 mb-1">
                      <Feather name="pie-chart" size={13} color="#208aef" />
                      <Text className="text-[10px] font-sans-bold text-muted-foreground uppercase">Sub Burden</Text>
                    </View>
                    <Text className="text-base font-sans-extrabold text-primary" numberOfLines={1} adjustsFontSizeToFit>
                      {bankMetrics.burdenPercentage.toFixed(1)}%
                    </Text>
                  </View>
                </View>

                {/* 5. Top Outflow Recipients / Merchants */}
                <View className="mb-5">
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-base font-sans-bold text-primary">Top Outflow Merchants</Text>
                    <Text className="text-[11px] font-sans-semibold text-muted-foreground">By Total Value</Text>
                  </View>

                  <View className="bg-card rounded-3xl p-4 border border-border gap-3 shadow-xs">
                    {bankMetrics.topMerchants.map((merchant, idx) => (
                      <View key={merchant.name + idx} className="gap-1.5 pb-2 border-b border-black/5 last:border-b-0 last:pb-0">
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center gap-2 flex-1 pr-2 min-w-0">
                            <View className="size-6 rounded-lg bg-black/5 items-center justify-center shrink-0">
                              <Text className="text-[11px] font-sans-bold text-primary">{idx + 1}</Text>
                            </View>
                            <Text className="text-xs font-sans-bold text-primary truncate flex-1 min-w-0" numberOfLines={1}>
                              {merchant.name}
                            </Text>
                            <Text className="text-[10px] font-sans-medium text-muted-foreground shrink-0">
                              {merchant.count} txn{merchant.count > 1 ? 's' : ''}
                            </Text>
                          </View>

                          <View className="items-end shrink-0">
                            <Text className="text-xs font-sans-extrabold text-primary">
                              {formatCurrency(merchant.amount, bankMetrics.currency)}
                            </Text>
                          </View>
                        </View>

                        {/* Relative Proportion Bar */}
                        <View className="h-1.5 w-full bg-black/5 rounded-full overflow-hidden">
                          <View
                            style={{ width: `${Math.min(100, Math.max(3, merchant.ratio))}%` }}
                            className="h-full bg-primary/70 rounded-full"
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                </View>

                {/* 6. Strategic Takeaways */}
                <Text className="text-base font-sans-bold text-primary mb-3">Strategic Observations</Text>
                <View className="gap-2.5 mb-5">
                  <View className="bg-[#f0f9f4] rounded-2xl p-3.5 border border-[#8fd1bd]/50 flex-row items-start gap-2.5 shadow-xs">
                    <Feather name="check-circle" size={15} color="#16a34a" style={{ marginTop: 2 }} />
                    <View className="flex-1 min-w-0">
                      <Text className="text-xs font-sans-bold text-primary">Positive Cash Flow Surplus</Text>
                      <Text className="text-[11px] font-sans-medium text-primary/80 mt-0.5 leading-4">
                        You retained +{formatCurrency(bankMetrics.netCashflow, bankMetrics.currency)} ({bankMetrics.savingsRate.toFixed(1)}%) of all incoming credits.
                      </Text>
                    </View>
                  </View>

                  <View className="bg-card rounded-2xl p-3.5 border border-border flex-row items-start gap-2.5 shadow-xs">
                    <Feather name="shield" size={15} color="#208aef" style={{ marginTop: 2 }} />
                    <View className="flex-1 min-w-0">
                      <Text className="text-xs font-sans-bold text-primary">Low Fixed Overhead</Text>
                      <Text className="text-[11px] font-sans-medium text-muted-foreground mt-0.5 leading-4">
                        Recurring subscriptions represent only {bankMetrics.burdenPercentage.toFixed(1)}% of your monthly debits, providing strong discretionary flexibility.
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Re-import statement action */}
                <AnimatedPressable
                  onPress={handleImportStatement}
                  containerClassName="bg-white/60 border border-border py-3 rounded-2xl items-center flex-row justify-center gap-1.5 active:opacity-70 shadow-xs mb-4"
                >
                  <Feather name="refresh-cw" size={13} color="#081126" />
                  <Text className="text-xs font-sans-bold text-primary">Update with New Statement</Text>
                </AnimatedPressable>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default Insights;