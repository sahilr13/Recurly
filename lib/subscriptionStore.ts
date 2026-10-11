import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import { syncRenewalNotifications } from './notifications';
import type { StatementSummary } from './statementParser';
import { cycleMonths } from './subMath';

const normName = (n: string) => (n || '').toLowerCase().replace(/[^a-z0-9]/g, '');

interface SubscriptionStore {
  subscriptions: Subscription[];
  statementSummary: StatementSummary | null;
  /** Names of the user's own accounts. Transfers to/from them are excluded from analytics. */
  myNames: string[];
  addSubscription: (subscription: Subscription) => void;
  addSubscriptions: (subscriptions: Subscription[]) => void;
  updateSubscription: (id: string, updated: Partial<Subscription>) => void;
  removeSubscription: (id: string) => void;
  setSubscriptions: (subscriptions: Subscription[]) => void;
  clearSubscriptions: () => void;
  setStatementSummary: (summary: StatementSummary | null) => void;
  addMyName: (name: string) => void;
  removeMyName: (name: string) => void;
  rolloverExpiredRenewals: () => void;
}

// Notifications are a side effect, so they run after state is set, never inside the set() updater.
const sync = (subs: Subscription[]) => {
  syncRenewalNotifications(subs).catch(() => {});
};

export const useSubscriptionStore = create<SubscriptionStore>()(
  persist(
    (set, get) => ({
      subscriptions: [],
      statementSummary: null,
      myNames: [],

      addSubscription: (subscription) => {
        const next = [subscription, ...get().subscriptions];
        set({ subscriptions: next });
        sync(next);
      },

      addSubscriptions: (newSubs) => {
        const existing = new Set(get().subscriptions.map((s) => normName(s.name)));
        const unique = newSubs.filter((s) => {
          const k = normName(s.name);
          if (existing.has(k)) return false;
          existing.add(k);
          return true;
        });
        if (unique.length === 0) return;
        const next = [...unique, ...get().subscriptions];
        set({ subscriptions: next });
        sync(next);
      },

      updateSubscription: (id, updated) => {
        const next = get().subscriptions.map((s) => (s.id === id ? { ...s, ...updated } : s));
        set({ subscriptions: next });
        sync(next);
      },

      removeSubscription: (id) => {
        const next = get().subscriptions.filter((s) => s.id !== id);
        set({ subscriptions: next });
        sync(next);
      },

      setSubscriptions: (subscriptions) => {
        set({ subscriptions });
        sync(subscriptions);
      },

      clearSubscriptions: () => {
        set({ subscriptions: [], statementSummary: null, myNames: [] });
        sync([]);
      },

      setStatementSummary: (statementSummary) => set({ statementSummary }),

      addMyName: (name) => {
        const clean = name.trim();
        if (clean.length < 3) return;
        const cur = get().myNames;
        if (cur.some((n) => n.toLowerCase() === clean.toLowerCase())) return;
        set({ myNames: [...cur, clean] });
      },

      removeMyName: (name) => set({ myNames: get().myNames.filter((n) => n !== name) }),

      rolloverExpiredRenewals: () => {
        const today = dayjs().startOf('day');
        let changed = false;

        const updated = get().subscriptions.map((sub) => {
          if (sub.status !== 'active' || !sub.renewalDate) return sub;
          let renewal = dayjs(sub.renewalDate);
          if (!renewal.isBefore(today)) return sub;

          changed = true;
          const step = cycleMonths(sub);
          let guard = 0;
          while (renewal.isBefore(today) && guard++ < 600) renewal = renewal.add(step, 'month');
          return { ...sub, renewalDate: renewal.toISOString() };
        });

        if (changed) {
          set({ subscriptions: updated });
          sync(updated);
        }
      },
    }),
    {
      name: 'user-subscriptions-live-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
