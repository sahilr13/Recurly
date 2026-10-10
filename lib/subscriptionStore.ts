import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SubscriptionStore {
  subscriptions: Subscription[];
  addSubscription: (subscription: Subscription) => void;
  addSubscriptions: (subscriptions: Subscription[]) => void;
  removeSubscription: (id: string) => void;
  setSubscriptions: (subscriptions: Subscription[]) => void;
  clearSubscriptions: () => void;
}

export const useSubscriptionStore = create<SubscriptionStore>()(
  persist(
    (set) => ({
      // Start completely empty with zero dummy items
      subscriptions: [],

      addSubscription: (subscription) =>
        set((state) => ({ subscriptions: [subscription, ...state.subscriptions] })),

      addSubscriptions: (newSubs) =>
        set((state) => {
          const existingNames = new Set(state.subscriptions.map((s) => s.name.toLowerCase()));
          const uniqueNew = newSubs.filter((s) => !existingNames.has(s.name.toLowerCase()));
          return { subscriptions: [...uniqueNew, ...state.subscriptions] };
        }),

      removeSubscription: (id) =>
        set((state) => ({
          subscriptions: state.subscriptions.filter((s) => s.id !== id),
        })),

      setSubscriptions: (subscriptions) => set({ subscriptions }),

      clearSubscriptions: () => set({ subscriptions: [] }),
    }),
    {
      // Changed key to flush any previously cached dummy items from device storage
      name: 'user-subscriptions-live-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);