import { Alert, Platform } from 'react-native';

/**
 * ============================================================================
 * EXPO GO SAFE IMPLEMENTATION
 * ============================================================================
 * Expo SDK 53+ removed expo-notifications native code from the standard Expo Go
 * Android client. This stub allows your store and UI to run smoothly without
 * crashing.
 */

export async function requestNotificationPermissions(): Promise<boolean> {
  Alert.alert(
    'Expo Go Notice',
    'Local notifications are currently paused in Expo Go. They will activate automatically once you run a native development build.'
  );
  return false;
}

export async function sendInstantTestNotification(): Promise<boolean> {
  Alert.alert(
    'Expo Go Notice',
    'Notifications are disabled in Expo Go. They will fire once running on a development client.'
  );
  return false;
}

export async function syncRenewalNotifications(_subscriptions: any[]): Promise<void> {
  // Safe no-op in Expo Go to prevent native runtime crashes
  return;
}

/**
 * ============================================================================
 * FULL NATIVE IMPLEMENTATION (READY FOR DEVELOPMENT BUILD / STANDALONE APK)
 * ============================================================================
 * When you build your custom dev client (via EAS or `npx expo run:android`),
 * replace the functions above with the code below:
 *
 * import * as Notifications from 'expo-notifications';
 * import dayjs from 'dayjs';
 *
 * Notifications.setNotificationHandler({
 *   handleNotification: async () => ({
 *     shouldShowAlert: true,
 *     shouldPlaySound: true,
 *     shouldSetBadge: false,
 *   }),
 * });
 *
 * export async function requestNotificationPermissions(): Promise<boolean> {
 *   const { status: existingStatus } = await Notifications.getPermissionsAsync();
 *   let finalStatus = existingStatus;
 *
 *   if (existingStatus !== 'granted') {
 *     const { status } = await Notifications.requestPermissionsAsync();
 *     finalStatus = status;
 *   }
 *
 *   if (finalStatus !== 'granted') {
 *     return false;
 *   }
 *
 *   if (Platform.OS === 'android') {
 *     await Notifications.setNotificationChannelAsync('renewals', {
 *       name: 'Subscription Renewals',
 *       importance: Notifications.AndroidImportance.HIGH,
 *       vibrationPattern: [0, 250, 250, 250],
 *       lightColor: '#208AEF',
 *     });
 *   }
 *
 *   return true;
 * }
 *
 * export async function sendInstantTestNotification(): Promise<boolean> {
 *   const hasPermission = await requestNotificationPermissions();
 *   if (!hasPermission) return false;
 *
 *   await Notifications.scheduleNotificationAsync({
 *     content: {
 *       title: 'Recurrly Reminder',
 *       body: 'Notifications are working! You will be alerted before renewals.',
 *       sound: true,
 *     },
 *     trigger: {
 *       seconds: 2,
 *       channelId: 'renewals',
 *     } as any,
 *   });
 *
 *   return true;
 * }
 *
 * export async function syncRenewalNotifications(subscriptions: Subscription[]): Promise<void> {
 *   await Notifications.cancelAllScheduledNotificationsAsync();
 *
 *   const hasPermission = await requestNotificationPermissions();
 *   if (!hasPermission) return;
 *
 *   const now = dayjs();
 *
 *   for (const sub of subscriptions) {
 *     if (sub.status !== 'active' || !sub.renewalDate) continue;
 *
 *     const renewal = dayjs(sub.renewalDate);
 *     const reminderDate = renewal.subtract(1, 'day').hour(10).minute(0).second(0);
 *
 *     if (reminderDate.isAfter(now)) {
 *       const secondsUntil = Math.max(1, reminderDate.diff(now, 'second'));
 *
 *       await Notifications.scheduleNotificationAsync({
 *         content: {
 *           title: `Upcoming Renewal: ${sub.name}`,
 *           body: `${sub.name} will renew tomorrow for ${sub.currency === 'USD' ? '$' : '₹'}${sub.price}.`,
 *           sound: true,
 *         },
 *         trigger: {
 *           seconds: secondsUntil,
 *           channelId: 'renewals',
 *         } as any,
 *       });
 *     }
 *   }
 * }
 */