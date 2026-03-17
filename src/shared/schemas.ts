import { z } from 'zod';
import type { Platform } from './types.js';

export const platformSchema = z.enum(['twitch', 'youtube', 'kick'] satisfies [Platform, ...Platform[]]);

export const createChannelSchema = z.object({
  platform: platformSchema.optional(),
  value: z.string().min(1),
  displayName: z.string().trim().min(1).optional()
});

export const updateChannelSchema = z.object({
  displayName: z.string().trim().min(1).optional(),
  enabled: z.boolean().optional()
});

export const channelTransferSchema = z.object({
  platform: platformSchema.optional(),
  value: z.string().min(1),
  displayName: z.string().trim().min(1).optional(),
  enabled: z.boolean().optional()
});

export const channelTransferListSchema = z.array(channelTransferSchema);

export const settingsPatchSchema = z.object({
  maxConcurrentLives: z.number().int().min(1).max(50).optional(),
  startOnLogin: z.boolean().optional(),
  minimizeToTray: z.boolean().optional(),
  autoOpenLives: z.boolean().optional(),
  closeGracePeriodSeconds: z.number().int().min(0).max(600).optional(),
  enableFocusSpoof: z.boolean().optional(),
  enablePerTabMute: z.boolean().optional(),
  enableLowBandwidthBackgroundLives: z.boolean().optional()
});
