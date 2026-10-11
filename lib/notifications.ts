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
    });
  }

  return true;
}

export async function sendInstantTestNotification(): Promise<boolean> {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return false;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Recurrly Alert',
      body: 'Notifications are active! You will only be alerted before renewals.',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 2,
      channelId: 'renewals',
    },
  });

  return true;
}

export async function syncRenewalNotifications(subscriptions: Subscription[]): Promise<void> {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  // Clear existing scheduled alarms before re-registering
  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = dayjs();

  for (const sub of subscriptions) {
    if (sub.status !== 'active' || !sub.renewalDate) continue;

    const renewal = dayjs(sub.renewalDate);
    // Schedule for 1 day prior at 10:00 AM
    let reminderDate = renewal.subtract(1, 'day').hour(10).minute(0).second(0);

    // Guard: Never schedule a notification for a past date or current moment
    if (!reminderDate.isValid() || reminderDate.isBefore(now.add(1, 'minute'))) {
      continue;
    }

    // Explicitly use SchedulableTriggerInputTypes.DATE so Android schedules it for the exact future date
    await Notifications.scheduleNotificationAsync({
      identifier: `renewal-${sub.id}`,
      content: {
        title: `Upcoming Renewal: ${sub.name}`,
        body: `${sub.name} renews tomorrow for ${sub.currency === 'USD' ? '$' : '₹'}${sub.price}.`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDate.toDate(),
        channelId: 'renewals',
      },
    });
  }
}