import { Text, View, Pressable, Image, Alert, ScrollView } from 'react-native';
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";
import { styled } from "nativewind";
import { useClerk, useUser } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import images from '../../constants/images';
import { posthog, posthogLog } from '../../lib/posthog';
import { useSubscriptionStore } from '../../lib/subscriptionStore';
import { formatCurrency } from '../../lib/utils';
import { requestNotificationPermissions, sendInstantTestNotification } from '../../lib/notifications';
import { pickAndParseStatement } from '../../lib/statementParser';
import AnimatedPressable from '../../components/AnimatedPressable';
import { useMemo } from 'react';

const SafeAreaView = styled(RNSafeAreaView);

const Settings = () => {
    const { signOut } = useClerk();
    const { user } = useUser();
    const { subscriptions, statementSummary, setStatementSummary, addSubscriptions, clearSubscriptions } = useSubscriptionStore();

    const stats = useMemo(() => {
        const active = subscriptions.filter((s) => s.status === 'active');
        let monthly = 0;
        let currency = 'INR';

        active.forEach((s) => {
            if (s.currency) currency = s.currency;
            const freq = s.frequency || s.billing;
            if (freq === 'Yearly') monthly += s.price / 12;
            else if (freq === 'Quarterly') monthly += s.price / 3;
            else monthly += s.price;
        });

        return {
            totalCount: subscriptions.length,
            activeCount: active.length,
            pausedCount: subscriptions.length - active.length,
            monthlySpend: monthly,
            annualRunRate: monthly * 12,
            currency,
        };
    }, [subscriptions]);

    const handleImportStatement = async () => {
        try {
            const parsed = await pickAndParseStatement();
            if (!parsed) return;

            setStatementSummary(parsed.summary);
            if (parsed.subscriptions.length > 0) {
                addSubscriptions(parsed.subscriptions);
            }
            Alert.alert('Statement Updated', `Processed ${parsed.summary.transactionCount} transactions successfully.`);
        } catch (error: any) {
            Alert.alert('Import Failed', error.message || 'Could not parse statement.');
        }
    };

    const handleClearData = () => {
        Alert.alert(
            'Reset On-Device Vault',
            'This will permanently delete all subscriptions and parsed bank statements from this device. Are you sure?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reset Everything',
                    style: 'destructive',
                    onPress: () => {
                        clearSubscriptions();
                        Alert.alert('Vault Cleared', 'All stored data has been removed from this device.');
                    },
                },
            ]
        );
    };

    const handleTestNotification = async () => {
        const success = await sendInstantTestNotification();
        if (success) {
            Alert.alert('Scheduled', 'A test reminder will appear in 2 seconds.');
        }
    };

    const handleEnableNotifications = async () => {
        const granted = await requestNotificationPermissions();
        if (granted) {
            Alert.alert('Notifications Active', 'You will be notified 24 hours prior to each renewal.');
        }
    };

    const handleSignOut = async () => {
        Alert.alert('Sign Out', 'Are you sure you want to log out of your account?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Sign Out',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await signOut();
                        posthog?.capture('user_signed_out');
                        posthogLog?.info('authentication completed', { auth_flow: 'sign_out' });
                        posthog?.reset();
                    } catch (error) {
                        console.error('Sign-out failed:', error);
                    }
                },
            },
        ]);
    };

    const displayName = user?.firstName || user?.fullName || user?.emailAddresses[0]?.emailAddress || 'User';
    const email = user?.emailAddresses[0]?.emailAddress;

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 130 }}
            >
                {/* Header */}
                <View className="mb-5">
                    <Text className="text-2xl font-sans-bold text-primary">Settings & Preferences</Text>
                    <Text className="text-xs font-sans-medium text-muted-foreground mt-0.5">
                        Manage your on-device vault, sync statements, and profile
                    </Text>
                </View>

                {/* 1. User Profile Card */}
                <View className="bg-card rounded-3xl p-4 border border-border mb-4 shadow-xs">
                    <View className="flex-row items-center gap-3.5">
                        <View className="relative">
                            <Image
                                source={user?.imageUrl ? { uri: user.imageUrl } : images.avatar}
                                className="size-14 rounded-2xl border border-black/10"
                            />
                            <View className="size-3.5 rounded-full bg-success border-2 border-card absolute -bottom-0.5 -right-0.5" />
                        </View>
                        <View className="flex-1 min-w-0">
                            <View className="flex-row items-center gap-1.5">
                                <Text className="text-base font-sans-bold text-primary truncate" numberOfLines={1}>
                                    {displayName}
                                </Text>
                            </View>
                            {email && (
                                <Text className="text-xs font-sans-medium text-muted-foreground truncate mt-0.5" numberOfLines={1}>
                                    {email}
                                </Text>
                            )}
                            <View className="flex-row items-center gap-2 mt-1.5">
                                <View className="bg-primary/10 px-2 py-0.5 rounded-md">
                                    <Text className="text-[10px] font-sans-bold text-primary">Clerk Authenticated</Text>
                                </View>
                                <Text className="text-[10px] font-sans-medium text-muted-foreground">
                                    Joined {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Active'}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* 2. On-Device Vault Metrics */}
                <Text className="text-sm font-sans-bold text-primary uppercase tracking-wider mb-2.5 px-1">
                    On-Device Vault
                </Text>
                <View className="bg-card rounded-3xl p-4 border border-border mb-4 shadow-xs gap-3">
                    <View className="flex-row items-center justify-between pb-3 border-b border-black/5">
                        <View className="flex-row items-center gap-2.5">
                            <View className="size-8 rounded-xl bg-accent/15 items-center justify-center">
                                <Feather name="database" size={14} color="#ea7a53" />
                            </View>
                            <View>
                                <Text className="text-xs font-sans-bold text-primary">Stored Subscriptions</Text>
                                <Text className="text-[10px] font-sans-medium text-muted-foreground">
                                    {stats.activeCount} active • {stats.pausedCount} paused
                                </Text>
                            </View>
                        </View>
                        <Text className="text-sm font-sans-extrabold text-primary">{stats.totalCount}</Text>
                    </View>

                    <View className="flex-row items-center justify-between pb-3 border-b border-black/5">
                        <View className="flex-row items-center gap-2.5">
                            <View className="size-8 rounded-xl bg-success/15 items-center justify-center">
                                <Feather name="trending-up" size={14} color="#16a34a" />
                            </View>
                            <View>
                                <Text className="text-xs font-sans-bold text-primary">Monthly Run-Rate</Text>
                                <Text className="text-[10px] font-sans-medium text-muted-foreground">
                                    ~{formatCurrency(stats.annualRunRate, stats.currency)}/year
                                </Text>
                            </View>
                        </View>
                        <Text className="text-sm font-sans-extrabold text-primary">
                            {formatCurrency(stats.monthlySpend, stats.currency)}
                        </Text>
                    </View>

                    <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-2.5">
                            <View className="size-8 rounded-xl bg-primary/10 items-center justify-center">
                                <Feather name="shield" size={14} color="#081126" />
                            </View>
                            <View>
                                <Text className="text-xs font-sans-bold text-primary">Security Model</Text>
                                <Text className="text-[10px] font-sans-medium text-muted-foreground">Local AsyncStorage</Text>
                            </View>
                        </View>
                        <View className="bg-success/15 px-2 py-0.5 rounded-full">
                            <Text className="text-[10px] font-sans-bold text-success uppercase">100% Private</Text>
                        </View>
                    </View>
                </View>

                {/* 3. Statement & Automation Engine */}
                <Text className="text-sm font-sans-bold text-primary uppercase tracking-wider mb-2.5 px-1">
                    Financial Feeds
                </Text>
                <View className="bg-card rounded-3xl p-4 border border-border mb-4 shadow-xs gap-3">
                    <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                            <View className="size-8 rounded-xl bg-[#208aef]/15 items-center justify-center">
                                <Feather name="file-text" size={14} color="#208aef" />
                            </View>
                            <View className="flex-1 min-w-0">
                                <Text className="text-xs font-sans-bold text-primary">Bank Statement Sync</Text>
                                <Text className="text-[10px] font-sans-medium text-muted-foreground truncate" numberOfLines={1}>
                                    {statementSummary 
                                        ? `${statementSummary.fileName} (${statementSummary.transactionCount} txns)`
                                        : 'No statement imported yet'}
                                </Text>
                            </View>
                        </View>

                        <AnimatedPressable
                            scaleTo={0.92}
                            onPress={handleImportStatement}
                            containerClassName="bg-primary/10 px-3 py-1.5 rounded-xl shrink-0"
                        >
                            <Text className="text-xs font-sans-bold text-primary">
                                {statementSummary ? 'Replace' : 'Import'}
                            </Text>
                        </AnimatedPressable>
                    </View>

                    <View className="pt-3 border-t border-black/5 flex-row items-center justify-between">
                        <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                            <View className="size-8 rounded-xl bg-accent/15 items-center justify-center">
                                <Feather name="bell" size={14} color="#ea7a53" />
                            </View>
                            <View className="flex-1 min-w-0">
                                <Text className="text-xs font-sans-bold text-primary">Renewal Reminders</Text>
                                <Text className="text-[10px] font-sans-medium text-muted-foreground">
                                    Alerts scheduled 24h prior to bill date
                                </Text>
                            </View>
                        </View>

                        <View className="flex-row items-center gap-1.5">
                            <AnimatedPressable
                                scaleTo={0.92}
                                onPress={handleTestNotification}
                                containerClassName="bg-white/70 border border-border px-2.5 py-1.5 rounded-xl shrink-0"
                            >
                                <Text className="text-[11px] font-sans-bold text-primary">Test</Text>
                            </AnimatedPressable>

                            <AnimatedPressable
                                scaleTo={0.92}
                                onPress={handleEnableNotifications}
                                containerClassName="bg-white/70 border border-border px-2.5 py-1.5 rounded-xl shrink-0"
                            >
                                <Text className="text-[11px] font-sans-bold text-primary">Verify</Text>
                            </AnimatedPressable>
                        </View>
                    </View>
                </View>

                {/* 4. Danger Zone & Account Actions */}
                <Text className="text-sm font-sans-bold text-primary uppercase tracking-wider mb-2.5 px-1">
                    System & Account
                </Text>
                <View className="gap-2.5">
                    <AnimatedPressable
                        scaleTo={0.98}
                        onPress={handleClearData}
                        containerClassName="bg-card border border-destructive/25 p-3.5 rounded-2xl flex-row items-center justify-between shadow-xs"
                    >
                        <View className="flex-row items-center gap-2.5">
                            <View className="size-8 rounded-xl bg-destructive/15 items-center justify-center">
                                <Feather name="trash-2" size={14} color="#dc2626" />
                            </View>
                            <View>
                                <Text className="text-xs font-sans-bold text-destructive">Wipe All Stored Data</Text>
                                <Text className="text-[10px] font-sans-medium text-muted-foreground">Clear local database</Text>
                            </View>
                        </View>
                        <Feather name="chevron-right" size={16} color="#dc2626" />
                    </AnimatedPressable>

                    <AnimatedPressable
                        scaleTo={0.98}
                        onPress={handleSignOut}
                        containerClassName="bg-destructive p-3.5 rounded-2xl flex-row items-center justify-center gap-2 shadow-xs"
                    >
                        <Feather name="log-out" size={15} color="#ffffff" />
                        <Text className="text-xs font-sans-bold text-white">Sign Out of Recurrly</Text>
                    </AnimatedPressable>

                    <View className="items-center py-2">
                        <Text className="text-[11px] font-sans-semibold text-muted-foreground">
                            Recurrly App • v1.0.0 (Local Vault Edition)
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default Settings;