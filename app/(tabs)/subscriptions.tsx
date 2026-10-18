import { Text, View, TextInput, FlatList, Pressable, LayoutAnimation, Alert } from 'react-native';
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";
import { styled } from "nativewind";
import { useState } from "react";
import { Feather } from '@expo/vector-icons';
import SubcriptionCard from "../../components/SubcriptionCard";
import CreateSubscriptionModal from "../../components/CreateSubscriptionModal";
import AnimatedPressable from "../../components/AnimatedPressable";
import { useSubscriptionStore } from "../../lib/subscriptionStore";
import { importStatementFlow } from "../../lib/importFlow";
import { syncHistoricalBankSms } from "../../lib/smsSync";

const SafeAreaView = styled(RNSafeAreaView);

type FilterTab = 'all' | 'active' | 'paused';

const Subscriptions = () => {
    const [searchQuery, setSearchQuery] = useState("");
    const [filterTab, setFilterTab] = useState<FilterTab>('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [editingSub, setEditingSub] = useState<Subscription | null>(null);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [isSyncingSms, setIsSyncingSms] = useState(false);

    const { subscriptions, updateSubscription } = useSubscriptionStore();

    const handleTabChange = (tab: FilterTab) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setFilterTab(tab);
    };

    const handleSaveEdit = (updated: Subscription) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        updateSubscription(updated.id, updated);
        setEditingSub(null);
        setIsEditModalVisible(false);
    };

    const handleSyncSms = async () => {
        setIsSyncingSms(true);
        try {
            const res = await syncHistoricalBankSms(90);
            if (res.error) {
                Alert.alert('SMS Sync', res.error);
            } else {
                Alert.alert(
                    'SMS Sync Complete',
                    `Parsed ${res.count} bank transactions from your inbox. Recurring charges have been added to your ledger.`
                );
            }
        } catch (e) {
            Alert.alert('Error', 'Could not read SMS alerts on this device.');
        } finally {
            setIsSyncingSms(false);
        }
    };

    const activeCount = subscriptions.filter((s) => s.status === 'active').length;
    const pausedCount = subscriptions.filter((s) => s.status !== 'active').length;

    const filteredSubscriptions = subscriptions
        .filter((sub) => {
            if (filterTab === 'active') return sub.status === 'active';
            if (filterTab === 'paused') return sub.status !== 'active';
            return true;
        })
        .filter((sub) =>
            sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            sub.category?.toLowerCase().includes(searchQuery.toLowerCase())
        );

    return (
        <SafeAreaView className="flex-1 bg-background">
            <FlatList
                data={filteredSubscriptions}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={
                    <View className="pt-2 mb-3">
                        {/* Header Bar */}
                        <View className="flex-row items-center justify-between mb-4">
                            <Text className="text-2xl font-sans-bold text-primary shrink-1" numberOfLines={1}>
                                Subscriptions
                            </Text>
                            <View className="flex-row items-center gap-1.5 shrink-0">
                                <AnimatedPressable
                                    scaleTo={0.92}
                                    onPress={handleSyncSms}
                                    disabled={isSyncingSms}
                                    containerClassName="bg-primary/10 border border-primary/20 px-3 py-2 rounded-2xl flex-row items-center gap-1.5 shadow-xs"
                                >
                                    <Feather name="message-square" size={13} color="#208AEF" />
                                    <Text className="text-xs font-sans-bold text-primary">
                                        {isSyncingSms ? 'Syncing...' : 'Sync SMS'}
                                    </Text>
                                </AnimatedPressable>

                                <AnimatedPressable
                                    scaleTo={0.92}
                                    onPress={importStatementFlow}
                                    containerClassName="bg-card border border-border px-3 py-2 rounded-2xl flex-row items-center gap-1.5 shadow-xs"
                                >
                                    <Feather name="upload" size={13} color="#081126" />
                                    <Text className="text-xs font-sans-bold text-primary">CSV</Text>
                                </AnimatedPressable>
                            </View>
                        </View>

                        {/* Search Bar */}
                        <View className="bg-card rounded-2xl px-3.5 py-2.5 flex-row items-center gap-2 border border-border mb-3 shadow-xs">
                            <Feather name="search" size={15} color="#999" />
                            <TextInput
                                className="flex-1 text-primary font-sans-medium text-sm py-0"
                                placeholder="Search by name or category..."
                                placeholderTextColor="#999"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {searchQuery.length > 0 && (
                                <Pressable onPress={() => setSearchQuery('')}>
                                    <Feather name="x" size={14} color="#999" />
                                </Pressable>
                            )}
                        </View>

                        {/* Segmented Tab Bar */}
                        <View className="flex-row bg-card rounded-2xl p-1 border border-border shadow-xs">
                            <Pressable
                                onPress={() => handleTabChange('all')}
                                className={`flex-1 py-2 items-center rounded-xl ${filterTab === 'all' ? 'bg-primary' : 'bg-transparent'}`}
                            >
                                <Text className={`text-xs font-sans-bold ${filterTab === 'all' ? 'text-white' : 'text-primary'}`}>
                                    All ({subscriptions.length})
                                </Text>
                            </Pressable>

                            <Pressable
                                onPress={() => handleTabChange('active')}
                                className={`flex-1 py-2 items-center rounded-xl ${filterTab === 'active' ? 'bg-primary' : 'bg-transparent'}`}
                            >
                                <Text className={`text-xs font-sans-bold ${filterTab === 'active' ? 'text-white' : 'text-primary'}`}>
                                    Active ({activeCount})
                                </Text>
                            </Pressable>

                            <Pressable
                                onPress={() => handleTabChange('paused')}
                                className={`flex-1 py-2 items-center rounded-xl ${filterTab === 'paused' ? 'bg-primary' : 'bg-transparent'}`}
                            >
                                <Text className={`text-xs font-sans-bold ${filterTab === 'paused' ? 'text-white' : 'text-primary'}`}>
                                    Paused ({pausedCount})
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                }
                renderItem={({ item }) => (
                    <SubcriptionCard
                        {...item}
                        expanded={expandedId === item.id}
                        onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        onEdit={() => {
                            setEditingSub(item);
                            setIsEditModalVisible(true);
                        }}
                    />
                )}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 130, gap: 12 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                ListEmptyComponent={
                    <View className="items-center py-12">
                        <Text className="text-sm font-sans-medium text-muted-foreground text-center">
                            {searchQuery ? 'No subscriptions match your search.' : 'No subscriptions found in this tab.'}
                        </Text>
                    </View>
                }
            />

            <CreateSubscriptionModal
                visible={isEditModalVisible}
                initialData={editingSub}
                onClose={() => {
                    setIsEditModalVisible(false);
                    setEditingSub(null);
                }}
                onSubmit={handleSaveEdit}
            />
        </SafeAreaView>
    );
};

export default Subscriptions;