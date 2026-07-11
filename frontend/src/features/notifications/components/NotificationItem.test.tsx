import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotificationItem from './NotificationItem';
import type { NotificationItemData } from './NotificationBell';

const reactionNotification: NotificationItemData = {
  _id: 'n1',
  type: 'page_reaction',
  actorUsername: 'test',
  actorAvatarUrl: null,
  circleName: 'Ванко рожден ден',
  albumTitle: 'Ванко рожден ден - 4г',
  album: 'a1',
  page: 'p1',
  reactionType: 'love',
  thumbnailUrl: null,
  read: false,
  relativeTime: 'Just now',
};

function renderItem(notification: NotificationItemData) {
  return render(
    <MemoryRouter>
      <ul>
        <NotificationItem
          notification={notification}
          isLast
          onItemClick={vi.fn()}
          onDismiss={vi.fn()}
          isDismissing={false}
          onToggleRead={vi.fn()}
          isTogglingRead={false}
        />
      </ul>
    </MemoryRouter>,
  );
}

describe('NotificationItem', () => {
  test('renders the reaction as an icon, not a quoted word', () => {
    renderItem(reactionNotification);

    expect(screen.getByText('favorite')).toBeInTheDocument();
    expect(screen.queryByText(/"Love"/)).not.toBeInTheDocument();
  });

  test('keeps the reaction name available to screen readers', () => {
    renderItem(reactionNotification);

    expect(screen.getByText('Love', { selector: '.sr-only' })).toBeInTheDocument();
  });
});
