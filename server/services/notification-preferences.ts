import { db } from '../db';
import { userEmailPreferences } from '../../shared/schema';
import { eq } from 'drizzle-orm';

export type NotificationType =
  | 'ptoNotifications'
  | 'contractNotifications'
  | 'reviewNotifications'
  | 'taskNotifications'
  | 'systemAnnouncements'
  | 'weeklyDigest'
  | 'mentionNotifications'
  | 'interviewNotifications'
  | 'calendarNotifications'
  | 'onboardingNotifications'
  | 'equipmentNotifications';

/**
 * Check if a user has a specific notification type enabled.
 * Returns true (send) if no preferences exist (default to on).
 */
export async function isNotificationEnabled(
  userId: string,
  type: NotificationType
): Promise<boolean> {
  try {
    const prefs = await db
      .select()
      .from(userEmailPreferences)
      .where(eq(userEmailPreferences.userId, userId))
      .limit(1);

    if (prefs.length === 0) {
      // No preferences saved — default all to true except weeklyDigest
      return type === 'weeklyDigest' ? false : true;
    }

    const val = prefs[0][type];
    return val === true || val === undefined || val === null;
  } catch (error) {
    console.error(`[NotificationPrefs] Error checking ${type} for user ${userId}:`, error);
    // On error, default to sending (don't silently drop notifications)
    return true;
  }
}

/**
 * Filter a list of user IDs to only those who have a notification type enabled.
 */
export async function filterByNotificationPreference(
  userIds: string[],
  type: NotificationType
): Promise<string[]> {
  if (userIds.length === 0) return [];

  try {
    const prefs = await db
      .select()
      .from(userEmailPreferences)
      .where(eq(userEmailPreferences.userId, userIds[0]));

    // Batch query all at once for efficiency
    const allPrefs = await db
      .select({
        userId: userEmailPreferences.userId,
        enabled: userEmailPreferences[type],
      })
      .from(userEmailPreferences);

    const prefMap = new Map(allPrefs.map(p => [p.userId, p.enabled]));

    return userIds.filter(id => {
      const enabled = prefMap.get(id);
      // If no preference set, default to true (except weeklyDigest)
      if (enabled === undefined || enabled === null) {
        return type === 'weeklyDigest' ? false : true;
      }
      return enabled === true;
    });
  } catch (error) {
    console.error(`[NotificationPrefs] Error filtering users for ${type}:`, error);
    return userIds; // On error, send to all
  }
}
