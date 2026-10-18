import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import dayjs from 'dayjs';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return false;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('renewals', {
        name: 'Subscription Renewals',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#208AEF',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    }

    return true;
  } catch (error) {
    console.warn('[Notifications] Permission request error:', error);
    return false;
  }
}

export async function sendInstantTestNotification(): Promise<boolean> {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return false;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Recurrly Alert',
        body: 'Notifications are active! You will only be alerted before renewals.',
        sound: 'default',
      },
      trigger: {
        type: 'timeInterval',
        seconds: 2,
        repeats: false,
        channelId: 'renewals',
      } as any,
    });

    return true;
  } catch (error) {
    console.warn('[Notifications] Failed to trigger test alert:', error);
    return false;
  }
}

export async function syncRenewalNotifications(subscriptions: any[]): Promise<void> {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission || !Array.isArray(subscriptions)) return;

    await Notifications.cancelAllScheduledNotificationsAsync();
    const now = dayjs();

    for (const sub of subscriptions) {
      if (sub.status !== 'active' || !sub.renewalDate) continue;

      const renewal = dayjs(sub.renewalDate);
      const reminderDate = renewal.subtract(1, 'day').hour(10).minute(0).second(0);

      // Do not schedule if reminder date is in the past
      if (!reminderDate.isValid() || reminderDate.isBefore(now.add(2, 'minute'))) {
        continue;
      }

      await Notifications.scheduleNotificationAsync({
        identifier: `renewal-${sub.id}`,
        content: {
          title: `Upcoming Renewal: ${sub.name}`,
          body: `${sub.name} renews tomorrow for ${sub.currency === 'USD' ? '$' : '₹'}${sub.price}.`,
          sound: 'default',
        },
        trigger: {
          type: 'date',
          date: reminderDate.toDate(),
          channelId: 'renewals',
        } as any,
      });
    }
  } catch (error) {
    console.warn('[Notifications] Failed to schedule renewal notifications:', error);
  }
}