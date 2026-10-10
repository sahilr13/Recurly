import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import { syncRenewalNotifications } from './notifications';
import { StatementSummary } from './statementParser';

interface SubscriptionStore {
  subscriptions: Subscription[];
  statementSummary: StatementSummary | null;
  addSubscription: (subscription: Subscription) => void;
  addSubscriptions: (subscriptions: Subscription[]) => void;
  updateSubscription: (id: string, updated: Partial<Subscription>) => void;
  removeSubscription: (id: string) => void;
  setSubscriptions: (subscriptions: Subscription[]) => void;
  clearSubscriptions: () => void;
  setStatementSummary: (summary: StatementSummary | null) => void;
  rolloverExpiredRenewals: () => void;
}

export const useSubscriptionStore = create<SubscriptionStore>()(
  persist(
    (set, get) => ({
      subscriptions: [],
      statementSummary: null,

      addSubscription: (subscription) => {
        set((state) => {
          const next = [subscription, ...state.subscriptions];
          syncRenewalNotifications(next).catch(() => {});
          return { subscriptions: next };
        });
      },

      addSubscriptions: (newSubs) => {
        set((state) => {
          const existingNames = new Set(state.subscriptions.map((s) => s.name.toLowerCase()));
          const uniqueNew = newSubs.filter((s) => !existingNames.has(s.name.toLowerCase()));
          const next = [...uniqueNew, ...state.subscriptions];
          syncRenewalNotifications(next).catch(() => {});
          return { subscriptions: next };
        });
      },

      updateSubscription: (id, updated) => {
        set((state) => {
          const next = state.subscriptions.map((s) => (s.id === id ? { ...s, ...updated } : s));
          syncRenewalNotifications(next).catch(() => {});
          return { subscriptions: next };
        });
      },

      removeSubscription: (id) => {
        set((state) => {
          const next = state.subscriptions.filter((s) => s.id !== id);
          syncRenewalNotifications(next).catch(() => {});
          return { subscriptions: next };
        });
      },

      setSubscriptions: (subscriptions) => {
        set({ subscriptions });
        syncRenewalNotifications(subscriptions).catch(() => {});
      },

      clearSubscriptions: () => {
        set({ subscriptions: [], statementSummary: null });
        syncRenewalNotifications([]).catch(() => {});
      },

      setStatementSummary: (statementSummary) => {
        set({ statementSummary });
      },

      rolloverExpiredRenewals: () => {
        const today = dayjs().startOf('day');
        let hasChanges = false;

        const updated = get().subscriptions.map((sub) => {
          if (sub.status !== 'active' || !sub.renewalDate) return sub;

          let renewal = dayjs(sub.renewalDate);
          if (renewal.isBefore(today)) {
            hasChanges = true;
            const stepMonths =
              sub.frequency === 'Quarterly' ? 3 : sub.frequency === 'Yearly' ? 12 : 1;

            while (renewal.isBefore(today)) {
              renewal = renewal.add(stepMonths, 'month');
            }

            return {
              ...sub,
              renewalDate: renewal.toISOString(),
            };
          }
          return sub;
        });

        if (hasChanges) {
          set({ subscriptions: updated });
          syncRenewalNotifications(updated).catch(() => {});
        }
      },
    }),
    {
      name: 'user-subscriptions-live-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);