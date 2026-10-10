import { Text, View, TextInput, FlatList, Pressable, Alert } from 'react-native';
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";
import { styled } from "nativewind";
import { useState } from "react";
import SubcriptionCard from "../../components/SubcriptionCard";
import { useSubscriptionStore } from "../../lib/subscriptionStore";
import { pickAndParseStatement } from "../../lib/statementParser";

const SafeAreaView = styled(RNSafeAreaView);

const Subscriptions = () => {
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const { subscriptions, addSubscriptions } = useSubscriptionStore();

    const handleImportStatement = async () => {
        try {
            const detected = await pickAndParseStatement();
            if (detected.length === 0) {
                Alert.alert('No Subscriptions Detected', 'No repeating monthly or yearly charges were found in this file.');
                return;
            }

            const namesList = detected.map((s) => `• ${s.name} ($${s.price}/${s.frequency === 'Yearly' ? 'yr' : 'mo'})`).join('\n');

            Alert.alert(
                'Subscriptions Found!',
                `Detected ${detected.length} recurring subscription(s):\n\n${namesList}\n\nAdd them to your dashboard?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Add All',
                        style: 'default',
                        onPress: () => {
                            addSubscriptions(detected);
                            Alert.alert('Success', 'Subscriptions have been saved to your device!');
                        },
                    },
                ]
            );
        } catch (error: any) {
            Alert.alert('Import Failed', error.message || 'Could not parse the selected CSV file.');
        }
    };

    const filteredSubscriptions = subscriptions.filter((subscription) =>
        subscription.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        subscription.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        subscription.plan?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <SafeAreaView className="flex-1 bg-background">
            <FlatList
                data={filteredSubscriptions}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={
                    <View className="px-5 pt-5">
                        <View className="flex-row items-center justify-between mb-5">
                            <Text className="text-3xl font-bold text-dark">Subscriptions</Text>
                            <Pressable
                                onPress={handleImportStatement}
                                className="bg-card border border-border px-3.5 py-2 rounded-xl active:opacity-70"
                            >
                                <Text className="text-xs font-bold text-primary">Import CSV</Text>
                            </Pressable>
                        </View>
                        
                        <TextInput
                            className="bg-card rounded-xl px-4 py-3 text-dark mb-4"
                            placeholder="Search subscriptions..."
                            placeholderTextColor="#666"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                }
                renderItem={({ item }) => (
                    <SubcriptionCard
                        {...item}
                        expanded={expandedId === item.id}
                        onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    />
                )}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, gap: 12 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
            />
        </SafeAreaView>
    );
};

export default Subscriptions;