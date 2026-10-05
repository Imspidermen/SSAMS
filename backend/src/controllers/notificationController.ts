import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as notificationService from '../services/notificationService';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const data = await notificationService.listNotifications(req.user!.id);
  const unread = await notificationService.unreadCount(req.user!.id);
  res.json({ success: true, data: { items: data, unreadCount: unread } });
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  await notificationService.markNotificationRead(req.user!.id, req.params.id);
  res.json({ success: true, data: { message: 'Marked as read' } });
});

export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  await notificationService.markAllNotificationsRead(req.user!.id);
  res.json({ success: true, data: { message: 'All notifications marked as read' } });
});
