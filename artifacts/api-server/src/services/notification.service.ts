import { eq, and, isNull, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { notificationsTable, type Notification } from "@workspace/db";

type NotificationType = Notification["type"];

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body?: string,
  actionUrl?: string,
): Promise<Notification> {
  const [notification] = await db
    .insert(notificationsTable)
    .values({ userId, type, title, body: body ?? null, actionUrl: actionUrl ?? null })
    .returning();
  if (!notification) throw new Error("Failed to create notification");
  return notification;
}

export async function getUserNotifications(
  userId: string,
  limit = 20,
): Promise<Notification[]> {
  return db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limit);
}

export async function markNotificationRead(
  notificationId: string,
  userId: string,
): Promise<boolean> {
  const result = await db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notificationsTable.id, notificationId),
        eq(notificationsTable.userId, userId),
        isNull(notificationsTable.readAt),
      ),
    )
    .returning({ id: notificationsTable.id });
  return result.length > 0;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notificationsTable.userId, userId),
        isNull(notificationsTable.readAt),
      ),
    );
}

export async function getUnreadCount(userId: string): Promise<number> {
  const result = await db
    .select({ count: notificationsTable.id })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.userId, userId),
        isNull(notificationsTable.readAt),
      ),
    );
  return result.length;
}
