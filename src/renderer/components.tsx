import type { ReactNode } from 'react';
import type { Channel, LiveSession } from '@shared/types';

export function PlatformBadge({ platform }: { platform: Channel['platform'] | LiveSession['platform'] }) {
  return <span className={`badge badge-${platform}`}>{platform}</span>;
}

export function EmptyState({
  title,
  description,
  action
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
