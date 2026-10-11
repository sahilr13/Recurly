import { Alert } from 'react-native';
import { pickAndParseStatement } from './statementParser';
import { useSubscriptionStore } from './subscriptionStore';
import { formatCurrency } from './utils';

/**
 * One import flow shared by Home, Subscriptions, Insights and Settings
 * (they previously each had their own slightly different copy).
 * Returns true if a statement was imported.
 */
export async function importStatementFlow(): Promise<boolean> {
  try {
    const store = useSubscriptionStore.getState();
    const parsed = await pickAndParseStatement(store.myNames);
    if (!parsed) return false;

    store.setStatementSummary(parsed.summary);

    // Only offer subscriptions that aren't already tracked.
    const existing = new Set(store.subscriptions.map((s) => s.name.toLowerCase().replace(/[^a-z0-9]/g, '')));
    const fresh = parsed.subscriptions.filter((s) => !existing.has(s.name.toLowerCase().replace(/[^a-z0-9]/g, '')));

    if (fresh.length === 0) {
      Alert.alert(
        'Statement imported',
        `Processed ${parsed.summary.transactionCount} transactions. No new recurring payments found. Bank Health is updated.`
      );
      return true;
    }

    const list = fresh
      .map((s) => `• ${s.name} (${formatCurrency(s.price, 'INR')}/${s.frequency === 'Yearly' ? 'yr' : s.frequency === 'Quarterly' ? 'qtr' : 'mo'})`)
      .join('\n');

    Alert.alert(
      'Statement imported',
      `Found ${fresh.length} new recurring payment(s):\n\n${list}\n\nAdd them to your dashboard? Bank Health is already updated.`,
      [
        { text: 'Skip', style: 'cancel' },
        { text: 'Add', onPress: () => useSubscriptionStore.getState().addSubscriptions(fresh) },
      ]
    );
    return true;
  } catch (err: any) {
    Alert.alert('Import failed', err?.message || 'Could not parse the statement.');
    return false;
  }
}
