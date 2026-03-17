import type { ReactNode } from 'react';
import type { Channel, LiveSession } from '@shared/types';

const PLATFORM_ICONS: Record<string, ReactNode> = {
  twitch: (
    <svg fill="currentColor" viewBox="0 0 24 24">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
    </svg>
  ),
  youtube: (
    <svg fill="currentColor" viewBox="0 0 24 24">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  ),
  kick: (
    <svg fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-1.97 9.289c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.26 14.238l-2.963-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.559 1.348z"/>
    </svg>
  ),
};

export function PlatformBadge({
  platform,
  size = 'normal',
}: {
  platform: Channel['platform'] | LiveSession['platform'];
  size?: 'normal' | 'small' | 'icon';
}) {
  if (size === 'icon') {
    return (
      <span className={`badge-icon badge-icon-${platform}`} title={platform}>
        {PLATFORM_ICONS[platform]}
      </span>
    );
  }
  const cls = size === 'small' ? `session-badge badge-${platform}` : `badge badge-${platform}`;
  return (
    <span className={cls}>
      {PLATFORM_ICONS[platform]}
      {platform}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
