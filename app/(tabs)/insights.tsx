import { View, Text, ScrollView, Pressable, LayoutAnimation, Alert, TextInput } from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { styled } from 'nativewind';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Feather } from '@expo/vector-icons';
import { useSubscriptionStore } from '../../lib/subscriptionStore';
import { formatCurrency } from '../../lib/utils';
import AnimatedPressable from '../../components/AnimatedPressable';
import { importStatementFlow } from '../../lib/importFlow';
import { syncHistoricalBankSms } from '../../lib/smsSync';
import { computeBankMetrics, TIERS } from '../../lib/analytics';
import { CATEGORY_COLORS, SPEND_COLORS } from '../../lib/categories';
import { cycleMonths, dueBetween, isBill, monthlyCost, nextDue, cyclePriceINR } from '../../lib/subMath';

const SafeAreaView = styled(RNSafeAreaView);

type MainTab = 'subscriptions' | 'bank_health';

const inr = (n: number) => formatCurrency(n, 'INR');
const ANNUAL_DISCOUNT_RATE = 0.167; // 16.7% benchmark discount

const Insights = () => {
  const router = useRouter();
  const { subscriptions, statementSummary, myNames, addMyName, removeMyName } = useSubscriptionStore();
  const [userTab, setUserTab] = useState<MainTab | null>(null);
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [spendView, setSpendView] = useState<'merchants' | 'people'>('merchants');
  const [nameInput, setNameInput] = useState('');
  const [selectedDay, setSelectedDay] = useState(0);
  const [isSyncingSms, setIsSyncingSms] = useState(false);

  const hasBankData = !!statementSummary?.transactions?.length;
  // Until the user picks a tab, show Bank Health if there is statement data but no subscriptions.
  // Derived (not initial state) because the persisted store hydrates asynchronously.
  const activeTab: MainTab = userTab ?? (hasBankData && subscriptions.length === 0 ? 'bank_health' : 'subscriptions');

  const handleTabSwitch = (tab: MainTab) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setUserTab(tab);
  };

  const handleSyncSms = async () => {
    setIsSyncingSms(true);
    try {
      const res = await syncHistoricalBankSms(90);
      if (res.error) {
        Alert.alert('SMS Sync', res.error);
      } else {
        Alert.alert(
          'Bank Health Updated',
          `Parsed ${res.count} transactions from SMS. Health score, daily burn, and cash flow are updated.`
        );
      }
    } catch (e) {
      Alert.alert('Error', 'Could not read SMS on device.');
    } finally {
      setIsSyncingSms(false);
    }
  };

  // ---------------- 1. Subscriptions & bills ----------------
  const sub = useMemo(() => {
    const active = subscriptions.filter((s) => s.status === 'active');
    const bills = active.filter(isBill);
    const subs = active.filter((s) => !isBill(s));

    const subsMonthly = subs.reduce((t, s) => t + monthlyCost(s), 0);
    const billsMonthly = bills.reduce((t, s) => t + monthlyCost(s), 0);
    const monthlyTotal = subsMonthly + billsMonthly;

    const top = active.reduce<Subscription | null>((best, s) => (!best || monthlyCost(s) > monthlyCost(best) ? s : best), null);

    const today = dayjs().startOf('day');
    const dueNext7 = dueBetween(active, today, today.add(7, 'day'));

    const canSave = subs.filter((s) => cycleMonths(s) === 1 && (s.category || 'Other') !== 'Other');
    const annualSavings = canSave.reduce((t, s) => t + monthlyCost(s), 0) * ANNUAL_DISCOUNT_RATE * 12;

    const catMap: Record<string, number> = {};
    active.forEach((s) => {
      const c = isBill(s) ? 'Bills & Rent' : s.category || 'Other';
      catMap[c] = (catMap[c] || 0) + monthlyCost(s);
    });
    const categories = Object.entries(catMap)
      .map(([name, amount]) => ({
        name,
        amount,
        pct: monthlyTotal > 0 ? Math.round((amount / monthlyTotal) * 100) : 0,
        color: CATEGORY_COLORS[name] || '#8fd1bd',
      }))
      .sort((a, b) => b.amount - a.amount);

    const week = Array.from({ length: 7 }, (_, i) => {
      const day = today.add(i, 'day');
      const amount = active.reduce((t, s) => {
        const d = nextDue(s);
        return d && d.isSame(day, 'day') ? t + cyclePriceINR(s) : t;
      }, 0);
      return { label: i === 0 ? 'Today' : day.format('ddd'), amount };
    });
    const weekMax = Math.max(...week.map((d) => d.amount), 0);

    return {
      subsCount: subs.length, billsCount: bills.length, subsMonthly, billsMonthly, monthlyTotal,
      annualTotal: monthlyTotal * 12, dailyBurn: monthlyTotal / 30.4, top, dueNext7, annualSavings,
      categories, week, weekMax,
    };
  }, [subscriptions]);

  // ---------------- 2. Bank health ----------------
  const bank = useMemo(
    () => computeBankMetrics(statementSummary, myNames, sub.monthlyTotal),
    [statementSummary, myNames, sub.monthlyTotal]
  );
  const needsReimport = !!statementSummary && !statementSummary.transactions?.length;

  const markAsMine = (name: string) =>
    Alert.alert(
      `Is "${name}" your own account?`,
      'Money moved to/from it will be left out of income, spending and the score.',
      [{ text: 'No' , style: 'cancel' }, { text: 'Yes, exclude', onPress: () => addMyName(name) }]
    );

  const submitName = () => {
    if (nameInput.trim().length < 3) return;
    addMyName(nameInput);
    setNameInput('');
  };

  const observations = useMemo(() => {
    if (!bank) return [];
    const list: { tone: 'good' | 'warn' | 'info'; title: string; body: string }[] = [];

    if (bank.savingsRate >= 20) list.push({ tone: 'good', title: 'Strong savings', body: `You kept ${bank.savingsRate.toFixed(1)}% of real income (${inr(bank.net)}).` });
    else if (bank.savingsRate > 0) list.push({ tone: 'info', title: 'Positive, but thin cushion', body: `You kept ${bank.savingsRate.toFixed(1)}% of income (${inr(bank.net)}). Aim for 20%+.` });
    else list.push({ tone: 'warn', title: 'Spending exceeded income', body: `Outflow was ${inr(Math.abs(bank.net))} more than income in this period.` });

    const share = bank.commitmentShareOfIncome;
    if (sub.monthlyTotal > 0 && bank.monthlyIncome > 0) {
      if (share <= 25) list.push({ tone: 'good', title: 'Low fixed commitments', body: `Subscriptions + bills take ${share.toFixed(0)}% of monthly income.` });
      else if (share <= 40) list.push({ tone: 'info', title: 'Moderate fixed commitments', body: `Subscriptions + bills take ${share.toFixed(0)}% of monthly income.` });
      else list.push({ tone: 'warn', title: 'Heavy fixed commitments', body: `Subscriptions + bills take ${share.toFixed(0)}% of monthly income, which limits flexibility.` });
    }

    if (bank.selfCount > 0) list.push({ tone: 'info', title: 'Own-account transfers excluded', body: `${bank.selfCount} transfers (${inr(bank.selfOut)} out, ${inr(bank.selfIn)} in) were left out of the numbers.` });
    if (bank.days < 28) list.push({ tone: 'info', title: 'Short statement', body: `Only ${bank.days} days of data, so monthly figures are rough estimates.` });
    return list;
  }, [bank, sub.monthlyTotal]);

  const shownMerchants = useMemo(() => {
    if (!bank) return [];
    return bank.merchants.filter((m) => (spendView === 'people' ? m.isPerson : !m.isPerson)).slice(0, 6);
  }, [bank, spendView]);

  const toneStyle = {
    good: { bg: 'bg-[#f0f9f4] border-[#8fd1bd]/50', icon: 'check-circle' as const, color: '#16a34a' },
    warn: { bg: 'bg-[#fff5ea] border-accent/40', icon: 'alert-triangle' as const, color: '#ea7a53' },
    info: { bg: 'bg-card border-border', icon: 'info' as const, color: '#208aef' },
  };

  const Segment = ({ tab, icon, label }: { tab: MainTab; icon: any; label: string }) => (
    <Pressable
      onPress={() => handleTabSwitch(tab)}
      className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5 ${activeTab === tab ? 'bg-primary' : 'bg-transparent'}`}
    >
      <Feather name={icon} size={14} color={activeTab === tab ? '#ffffff' : '#081126'} />
      <Text className={`text-xs font-sans-bold ${activeTab === tab ? 'text-white' : 'text-primary'}`}>{label}</Text>
    </Pressable>
  );

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
          <Text className="text-xl font-sans-bold text-primary shrink-1 px-2" numberOfLines={1}>Financial Insights</Text>
          
          <View className="flex-row items-center gap-1.5 shrink-0">
            <AnimatedPressable
              scaleTo={0.92}
              onPress={handleSyncSms}
              disabled={isSyncingSms}
              containerClassName="size-11 rounded-2xl border border-primary/20 bg-primary/10 items-center justify-center active:opacity-70 shadow-xs"
            >
              <Feather name="message-square" size={16} color="#208AEF" />
            </AnimatedPressable>

            <Pressable
              onPress={importStatementFlow}
              className="size-11 rounded-2xl border border-border bg-card items-center justify-center active:opacity-70 shadow-xs"
            >
              <Feather name="upload" size={16} color="#081126" />
            </Pressable>
          </View>
        </View>

        <View className="flex-row bg-card rounded-2xl p-1 border border-border mb-5 shadow-xs">
          <Segment tab="subscriptions" icon="pie-chart" label="Subscriptions" />
          <Segment tab="bank_health" icon="activity" label="Bank Health" />
        </View>

        {/* ===================== TAB 1 ===================== */}
        {activeTab === 'subscriptions' && (
          <View>
            {subscriptions.length === 0 && (
              <View className="bg-card rounded-2xl p-4 border border-border mb-5 shadow-xs">
                <Text className="text-xs font-sans-bold text-primary">No recurring payments detected yet</Text>
                <Text className="text-[11px] font-sans-medium text-muted-foreground mt-1 leading-4">
                  {hasBankData
                    ? 'Your bank data is analysed separately. Open the Bank Health tab to see it.'
                    : 'Sync SMS or import a statement to get started.'}
                </Text>
                {hasBankData && (
                  <Pressable onPress={() => handleTabSwitch('bank_health')} className="mt-3 self-start bg-primary px-3.5 py-2 rounded-xl active:opacity-80">
                    <Text className="text-xs font-sans-bold text-white">View Bank Health</Text>
                  </Pressable>
                )}
              </View>
            )}

            <View className="bg-primary rounded-3xl p-5 mb-5 shadow-sm">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-xs font-sans-semibold text-white/70 uppercase tracking-wider">
                  {period === 'monthly' ? 'Monthly Commitment' : 'Annual Run-Rate'}
                </Text>
                <View className="flex-row bg-white/10 rounded-xl p-0.5 border border-white/10">
                  {(['monthly', 'yearly'] as const).map((p) => (
                    <Pressable key={p} onPress={() => setPeriod(p)} className={`px-2.5 py-1 rounded-lg ${period === p ? 'bg-accent' : 'bg-transparent'}`}>
                      <Text className="text-[10px] font-sans-bold text-white">{p === 'monthly' ? 'Monthly' : 'Yearly'}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <Text className="text-3xl font-sans-extrabold text-white mt-1" numberOfLines={1} adjustsFontSizeToFit>
                {inr(period === 'monthly' ? sub.monthlyTotal : sub.annualTotal)}
              </Text>

              <Text className="text-[11px] font-sans-medium text-white/60 mt-1">
                Subscriptions {inr(period === 'monthly' ? sub.subsMonthly : sub.subsMonthly * 12)} · Bills &amp; rent {inr(period === 'monthly' ? sub.billsMonthly : sub.billsMonthly * 12)}
              </Text>

              <View className="flex-row items-center justify-between border-t border-white/15 mt-4 pt-3">
                <View className="flex-1">
                  <Text className="text-[11px] font-sans-medium text-white/60">Daily Burn Rate</Text>
                  <Text className="text-sm font-sans-bold text-white mt-0.5" numberOfLines={1}>{inr(sub.dailyBurn)}/day</Text>
                </View>
                <View className="h-7 w-[1px] bg-white/15 mx-3" />
                <View className="flex-1 items-end">
                  <Text className="text-[11px] font-sans-medium text-white/60">Active</Text>
                  <Text className="text-sm font-sans-bold text-white mt-0.5">
                    {sub.subsCount} subs · {sub.billsCount} bills
                  </Text>
                </View>
              </View>
            </View>

            <Text className="text-base font-sans-bold text-primary mb-3">Commitment Insights</Text>
            <View className="gap-2.5 mb-5">
              {sub.top && (
                <View className="bg-card rounded-2xl p-4 border border-border flex-row items-center justify-between shadow-xs">
                  <View className="flex-1 pr-2 min-w-0">
                    <View className="flex-row items-center gap-1.5 mb-0.5">
                      <Feather name="alert-circle" size={13} color="#ea7a53" />
                      <Text className="text-[11px] font-sans-bold text-accent uppercase tracking-wider">Top Commitment</Text>
                    </View>
                    <Text className="text-base font-sans-bold text-primary" numberOfLines={1}>{sub.top.name}</Text>
                    <Text className="text-xs font-sans-medium text-muted-foreground mt-0.5">Largest recurring expense per month.</Text>
                  </View>
                  <View className="items-end shrink-0">
                    <Text className="text-base font-sans-extrabold text-primary">{formatCurrency(sub.top.price, sub.top.currency)}</Text>
                    <Text className="text-[10px] font-sans-medium text-muted-foreground">{sub.top.frequency || sub.top.billing}</Text>
                  </View>
                </View>
              )}

              <View className="bg-card rounded-2xl p-4 border border-border flex-row items-center justify-between shadow-xs">
                <View className="flex-1 pr-2 min-w-0">
                  <View className="flex-row items-center gap-1.5 mb-0.5">
                    <Feather name="clock" size={13} color="#081126" />
                    <Text className="text-[11px] font-sans-bold text-primary/70 uppercase tracking-wider">Next 7 Days</Text>
                  </View>
                  <Text className="text-base font-sans-bold text-primary">Required Cash Outflow</Text>
                  <Text className="text-xs font-sans-medium text-muted-foreground mt-0.5">Due between today and {dayjs().add(6, 'day').format('ddd D MMM')}.</Text>
                </View>
                <Text className="text-base font-sans-extrabold text-accent shrink-0">{inr(sub.dueNext7)}</Text>
              </View>

              {sub.annualSavings > 0 && (
                <View className="bg-[#f0f9f4] rounded-2xl p-4 border border-[#8fd1bd]/50 flex-row items-center justify-between shadow-xs">
                  <View className="flex-1 pr-2 min-w-0">
                    <View className="flex-row items-center gap-1.5 mb-0.5">
                      <Feather name="trending-down" size={13} color="#16a34a" />
                      <Text className="text-[11px] font-sans-bold text-success uppercase tracking-wider">Annual Plan Saving</Text>
                    </View>
                    <Text className="text-xs font-sans-medium text-primary/80 mt-0.5">
                      Estimate if your monthly services offer yearly plans (~16.7% off). Rent and bills excluded.
                    </Text>
                  </View>
                  <Text className="text-sm font-sans-extrabold text-success shrink-0">~{inr(sub.annualSavings)}/yr</Text>
                </View>
              )}
            </View>

            <View className="mb-5">
              <Text className="text-base font-sans-bold text-primary mb-3">Category Allocation</Text>
              {sub.categories.length === 0 ? (
                <View className="bg-card p-5 rounded-2xl border border-border items-center">
                  <Text className="text-xs font-sans-medium text-muted-foreground">No active subscriptions to categorize.</Text>
                </View>
              ) : (
                <View className="bg-card rounded-3xl p-4 border border-border gap-3.5 shadow-xs">
                  <View className="h-2.5 w-full bg-black/5 rounded-full overflow-hidden flex-row">
                    {sub.categories.map((c) => (
                      <View key={c.name} style={{ flex: c.amount, backgroundColor: c.color }} className="h-full" />
                    ))}
                  </View>
                  <View className="gap-2">
                    {sub.categories.map((c) => (
                      <View key={c.name} className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-2 flex-1 pr-2">
                          <View style={{ backgroundColor: c.color }} className="size-2 rounded-full shrink-0" />
                          <Text className="text-xs font-sans-semibold text-primary" numberOfLines={1}>{c.name}</Text>
                          <Text className="text-[10px] font-sans-bold text-muted-foreground shrink-0">({c.pct}%)</Text>
                        </View>
                        <Text className="text-xs font-sans-bold text-primary shrink-0">{inr(c.amount)}/mo</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ===================== TAB 2 ===================== */}
        {activeTab === 'bank_health' && (
          <View>
            {!bank ? (
              <View className="bg-card rounded-3xl p-6 border border-border items-center my-4 shadow-xs">
                <View className="size-16 rounded-2xl bg-accent/15 items-center justify-center mb-4">
                  <Feather name="file-text" size={28} color="#ea7a53" />
                </View>
                <Text className="text-lg font-sans-bold text-primary text-center">
                  {needsReimport ? 'Re-sync Bank Data' : 'No Financial Data Analyzed Yet'}
                </Text>
                <Text className="text-xs font-sans-medium text-muted-foreground text-center mt-2 mb-6 px-3 leading-5">
                  Scan your transaction SMS alerts or import a statement CSV to calculate your health score, cash flow, and top payees completely on-device.
                </Text>
                
                <View className="flex-row gap-3 w-full justify-center">
                  <AnimatedPressable
                    onPress={handleSyncSms}
                    disabled={isSyncingSms}
                    containerClassName="bg-primary/10 border border-primary/20 px-4 py-3 rounded-2xl flex-row items-center gap-2 shadow-xs"
                  >
                    <Feather name="message-square" size={15} color="#208AEF" />
                    <Text className="text-xs font-sans-bold text-primary">
                      {isSyncingSms ? 'Syncing...' : 'Sync Bank SMS'}
                    </Text>
                  </AnimatedPressable>

                  <AnimatedPressable
                    onPress={importStatementFlow}
                    containerClassName="bg-primary px-4 py-3 rounded-2xl flex-row items-center gap-2 shadow-xs"
                  >
                    <Feather name="upload" size={15} color="#ffffff" />
                    <Text className="text-xs font-sans-bold text-white">Import CSV</Text>
                  </AnimatedPressable>
                </View>
              </View>
            ) : (
              <View>
                <View className="flex-row items-center justify-between mb-3 px-1">
                  <View className="flex-row items-center gap-1.5 flex-1 min-w-0 pr-2">
                    <Feather name="shield" size={13} color="#16a34a" />
                    <Text className="text-xs font-sans-bold text-primary" numberOfLines={1}>{statementSummary?.fileName}</Text>
                  </View>
                  <View className="bg-primary/10 px-2.5 py-1 rounded-full shrink-0">
                    <Text className="text-[10px] font-sans-bold text-primary uppercase">{bank.transactionCount} Txns</Text>
                  </View>
                </View>

                {/* Financial Health Score */}
                <View className="bg-card rounded-3xl p-5 border border-border mb-4 shadow-xs">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-xs font-sans-semibold text-muted-foreground uppercase tracking-wider">Financial Health Score</Text>
                    <View style={{ backgroundColor: `${bank.tier.color}15` }} className="px-2.5 py-0.5 rounded-full border border-black/5">
                      <Text style={{ color: bank.tier.color }} className="text-[11px] font-sans-bold uppercase">{bank.tier.label}</Text>
                    </View>
                  </View>
                  <View className="flex-row items-baseline gap-1.5 my-1">
                    <Text className="text-4xl font-sans-extrabold text-primary">{bank.score}</Text>
                    <Text className="text-base font-sans-bold text-muted-foreground">/ 100</Text>
                  </View>
                  <View className="flex-row gap-1.5 mt-2 mb-2">
                    {TIERS.map((t) => (
                      <View key={t.key} style={{ backgroundColor: t.color, opacity: t.key === bank.tier.key ? 1 : 0.25 }} className="flex-1 h-2 rounded-full" />
                    ))}
                  </View>
                  <View className="flex-row justify-between pt-1">
                    {TIERS.map((t) => (
                      <Text key={t.key} className="text-[10px] font-sans-bold text-muted-foreground">{t.label}</Text>
                    ))}
                  </View>
                  <View className="border-t border-border mt-3 pt-3 flex-row items-center justify-between">
                    <Text className="text-xs font-sans-medium text-muted-foreground">Income kept</Text>
                    <Text className={`text-xs font-sans-bold ${bank.savingsRate >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {bank.savingsRate >= 0 ? '+' : ''}{bank.savingsRate.toFixed(1)}%
                    </Text>
                  </View>
                </View>

                {/* Cash flow */}
                <View className="bg-primary rounded-3xl p-5 mb-4 shadow-sm">
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-xs font-sans-semibold text-white/70 uppercase tracking-wider">Cash Flow</Text>
                    <Text className="text-[11px] font-sans-medium text-white/60">
                      {dayjs(bank.startDate).format('DD MMM')} – {dayjs(bank.endDate).format('DD MMM')}
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-1 pr-2">
                      <Text className="text-[11px] font-sans-medium text-white/60">Income</Text>
                      <Text className="text-lg font-sans-bold text-white" numberOfLines={1} adjustsFontSizeToFit>+{inr(bank.realIncome)}</Text>
                    </View>
                    <View className="flex-1 items-end pl-2">
                      <Text className="text-[11px] font-sans-medium text-white/60">Spending</Text>
                      <Text className="text-lg font-sans-bold text-white/90" numberOfLines={1} adjustsFontSizeToFit>-{inr(bank.realSpend)}</Text>
                    </View>
                  </View>
                  <View className="h-2.5 w-full bg-white/20 rounded-full overflow-hidden flex-row">
                    <View style={{ flex: Math.max(bank.realSpend, 1) }} className="h-full bg-accent" />
                    <View style={{ flex: Math.max(bank.net, 0) }} className="h-full bg-[#16a34a]" />
                  </View>
                  <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-white/10">
                    <Text className="text-xs font-sans-medium text-white/70">Net</Text>
                    <Text className={`text-sm font-sans-extrabold ${bank.net >= 0 ? 'text-[#8fd1bd]' : 'text-white'}`}>
                      {bank.net >= 0 ? '+' : '-'}{inr(Math.abs(bank.net))}
                    </Text>
                  </View>
                </View>

                {/* Key Vitals */}
                <Text className="text-base font-sans-bold text-primary mb-3">Key Vitals</Text>
                <View className="flex-row gap-2.5 mb-2.5">
                  {[
                    { icon: 'arrow-down-left', color: '#16a34a', label: 'Income / mo', value: inr(bank.monthlyIncome) },
                    { icon: 'arrow-up-right', color: '#dc2626', label: 'Spend / mo', value: inr(bank.monthlySpend) },
                  ].map((v) => (
                    <View key={v.label} className="flex-1 bg-card rounded-2xl p-3.5 border border-border shadow-xs min-w-0">
                      <View className="flex-row items-center gap-1.5 mb-1">
                        <Feather name={v.icon as any} size={13} color={v.color} />
                        <Text className="text-[10px] font-sans-bold text-muted-foreground uppercase">{v.label}</Text>
                      </View>
                      <Text className="text-base font-sans-extrabold text-primary" numberOfLines={1} adjustsFontSizeToFit>{v.value}</Text>
                    </View>
                  ))}
                </View>
                <View className="flex-row gap-2.5 mb-5">
                  {[
                    { icon: 'zap', color: '#ea7a53', label: 'Daily spend', value: `${inr(bank.dailySpend)}/d` },
                    { icon: 'pie-chart', color: '#208aef', label: 'Fixed / income', value: `${bank.commitmentShareOfIncome.toFixed(0)}%` },
                  ].map((v) => (
                    <View key={v.label} className="flex-1 bg-card rounded-2xl p-3.5 border border-border shadow-xs min-w-0">
                      <View className="flex-row items-center gap-1.5 mb-1">
                        <Feather name={v.icon as any} size={13} color={v.color} />
                        <Text className="text-[10px] font-sans-bold text-muted-foreground uppercase">{v.label}</Text>
                      </View>
                      <Text className="text-base font-sans-extrabold text-primary" numberOfLines={1} adjustsFontSizeToFit>{v.value}</Text>
                    </View>
                  ))}
                </View>

                {/* Top Outflow */}
                <View className="mb-5">
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-base font-sans-bold text-primary">Top Outflow</Text>
                    <View className="flex-row bg-card rounded-xl p-0.5 border border-border">
                      {(['merchants', 'people'] as const).map((v) => (
                        <Pressable key={v} onPress={() => setSpendView(v)} className={`px-3 py-1 rounded-lg ${spendView === v ? 'bg-primary' : 'bg-transparent'}`}>
                          <Text className={`text-[10px] font-sans-bold ${spendView === v ? 'text-white' : 'text-primary'}`}>{v === 'merchants' ? 'Merchants' : 'People'}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View className="bg-card rounded-3xl p-4 border border-border gap-3 shadow-xs">
                    {shownMerchants.length === 0 && (
                      <Text className="text-xs font-sans-medium text-muted-foreground text-center py-2">Nothing here yet.</Text>
                    )}
                    {shownMerchants.map((m, idx) => (
                      <Pressable key={m.name} onPress={() => markAsMine(m.name)} className="gap-1.5 active:opacity-70">
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center gap-2 flex-1 pr-2 min-w-0">
                            <View className="size-6 rounded-lg bg-black/5 items-center justify-center shrink-0">
                              <Text className="text-[11px] font-sans-bold text-primary">{idx + 1}</Text>
                            </View>
                            <Text className="text-xs font-sans-bold text-primary flex-1 min-w-0" numberOfLines={1}>{m.name}</Text>
                            <Text className="text-[10px] font-sans-medium text-muted-foreground shrink-0">{m.count} txn{m.count > 1 ? 's' : ''}</Text>
                          </View>
                          <Text className="text-xs font-sans-extrabold text-primary shrink-0">{inr(m.amount)}</Text>
                        </View>
                        <View className="h-1.5 w-full bg-black/5 rounded-full overflow-hidden">
                          <View style={{ width: `${Math.max(3, Math.min(100, (m.amount / bank.realSpend) * 100))}%` }} className="h-full bg-primary/70 rounded-full" />
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Own Accounts */}
                <View className="mb-5">
                  <Text className="text-base font-sans-bold text-primary mb-1">My Own Accounts</Text>
                  <Text className="text-[11px] font-sans-medium text-muted-foreground mb-3 leading-4">
                    Transfers to/from these names are excluded from total spend.
                  </Text>
                  <View className="bg-card rounded-3xl p-4 border border-border gap-3 shadow-xs">
                    <View className="flex-row flex-wrap gap-1.5">
                      {myNames.length === 0 && <Text className="text-xs font-sans-medium text-muted-foreground">None added yet.</Text>}
                      {myNames.map((n) => (
                        <Pressable key={n} onPress={() => removeMyName(n)} className="flex-row items-center gap-1 bg-primary/10 px-2.5 py-1.5 rounded-xl">
                          <Text className="text-xs font-sans-bold text-primary">{n}</Text>
                          <Feather name="x" size={11} color="#081126" />
                        </Pressable>
                      ))}
                    </View>
                    <View className="flex-row items-center gap-2">
                      <TextInput
                        className="flex-1 rounded-2xl border border-border bg-background px-3.5 py-2.5 text-xs font-sans-medium text-primary"
                        placeholder="Add a name, e.g. sahil raul"
                        placeholderTextColor="#999"
                        value={nameInput}
                        onChangeText={setNameInput}
                        onSubmitEditing={submitName}
                        returnKeyType="done"
                      />
                      <Pressable onPress={submitName} className="px-4 py-2.5 rounded-2xl bg-primary active:opacity-80">
                        <Text className="text-xs font-sans-bold text-white">Add</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>

                {/* Observations */}
                <Text className="text-base font-sans-bold text-primary mb-3">Observations</Text>
                <View className="gap-2.5 mb-5">
                  {observations.map((o) => {
                    const t = toneStyle[o.tone];
                    return (
                      <View key={o.title} className={`${t.bg} rounded-2xl p-3.5 border flex-row items-start gap-2.5 shadow-xs`}>
                        <Feather name={t.icon} size={15} color={t.color} style={{ marginTop: 2 }} />
                        <View className="flex-1 min-w-0">
                          <Text className="text-xs font-sans-bold text-primary">{o.title}</Text>
                          <Text className="text-[11px] font-sans-medium text-primary/80 mt-0.5 leading-4">{o.body}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>

                <View className="flex-row gap-2.5 mb-4">
                  <AnimatedPressable
                    onPress={handleSyncSms}
                    disabled={isSyncingSms}
                    containerClassName="flex-1 bg-primary/10 border border-primary/20 py-3 rounded-2xl items-center flex-row justify-center gap-1.5 active:opacity-70 shadow-xs"
                  >
                    <Feather name="message-square" size={13} color="#208AEF" />
                    <Text className="text-xs font-sans-bold text-primary">
                      {isSyncingSms ? 'Syncing...' : 'Sync SMS'}
                    </Text>
                  </AnimatedPressable>

                  <AnimatedPressable
                    onPress={importStatementFlow}
                    containerClassName="flex-1 bg-white/60 border border-border py-3 rounded-2xl items-center flex-row justify-center gap-1.5 active:opacity-70 shadow-xs"
                  >
                    <Feather name="refresh-cw" size={13} color="#081126" />
                    <Text className="text-xs font-sans-bold text-primary">New Statement</Text>
                  </AnimatedPressable>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default Insights;