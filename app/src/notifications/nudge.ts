import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { BEFORE_PHOTO_GRACE_SECONDS, ESCALATION_CONTACT } from '../config';

/**
 * The before-photo escalation.
 *
 * A code can start without a photo — the crew member taps "Start without a
 * photo" and the clock runs. Five minutes later, if no before photo exists for
 * that code, a notification drops and the photo screen reopens on top. It
 * fires once per code, and it says who has been copied, because a nudge that
 * doesn't say who is watching gets ignored.
 */

const CHANNEL = 'photo-reminders';

let configured = false;

export async function configureNotifications(): Promise<void> {
  if (configured) return;
  configured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Photo reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 220, 120, 220],
      lightColor: '#3cc84a',
    });
  }

  const current = await Notifications.getPermissionsAsync();
  if (!current.granted && current.canAskAgain) {
    await Notifications.requestPermissionsAsync();
  }
}

export function beforePhotoBody(codeNumber: string, codeName: string, minutes: number): string {
  return `${codeNumber} ${codeName.toLowerCase()} started ${minutes} minutes ago. ${ESCALATION_CONTACT} has been copied.`;
}

/**
 * Schedule the 5-minute reminder for a code that just started.
 * Returns the id so it can be cancelled the moment a before photo lands.
 */
export async function scheduleBeforePhotoNudge(
  codeNumber: string,
  codeName: string,
  seconds: number = BEFORE_PHOTO_GRACE_SECONDS,
): Promise<string | null> {
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Before photo not taken',
        body: beforePhotoBody(codeNumber, codeName, Math.round(seconds / 60)),
        data: { kind: 'before-photo', code: codeNumber },
        ...(Platform.OS === 'android' ? { channelId: CHANNEL } : null),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, seconds),
        repeats: false,
      },
    });
  } catch {
    // Notifications are a nudge, never a dependency. If the OS says no, the
    // amber strip on the clock screen still carries the requirement.
    return null;
  }
}

export async function cancelNudge(id: string | null): Promise<void> {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // already fired or already gone
  }
}
