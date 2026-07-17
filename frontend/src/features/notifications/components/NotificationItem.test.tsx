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
  commentText: null,
  thumbnailUrl: null,
  read: false,
  relativeTime: 'Just now',
};

const albumReactionNotification: NotificationItemData = {
  _id: 'n2',
  type: 'album_reaction',
  actorUsername: 'maria',
  actorAvatarUrl: null,
  circleName: null,
  albumTitle: 'Summer Trip',
  album: 'a2',
  page: null,
  reactionType: null,
  commentText: null,
  thumbnailUrl: null,
  read: false,
  relativeTime: 'Just now',
};

const commentNotification: NotificationItemData = {
  _id: 'n3',
  type: 'page_comment',
  actorUsername: 'sam',
  actorAvatarUrl: null,
  circleName: null,
  albumTitle: 'Summer Trip',
  album: 'a3',
  page: 'p3',
  reactionType: null,
  commentText: 'What a lovely photo, I really love the lighting here!',
  thumbnailUrl: null,
  read: false,
  relativeTime: 'Just now',
};

const replyNotification: NotificationItemData = {
  _id: 'n4',
  type: 'comment_reply',
  actorUsername: 'sam',
  actorAvatarUrl: null,
  circleName: null,
  albumTitle: 'Summer Trip',
  album: 'a4',
  page: 'p4',
  reactionType: null,
  commentText: 'Totally agree, the light is amazing!',
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

  test('renders an album_reaction notification as "loved [heart] AlbumTitle"', () => {
    renderItem(albumReactionNotification);

    expect(screen.getByText(/loved/)).toBeInTheDocument();
    expect(screen.getByText('favorite')).toBeInTheDocument();
    expect(screen.getByText('Summer Trip')).toBeInTheDocument();
  });

  test('links an album_reaction notification to the album', () => {
    renderItem(albumReactionNotification);

    expect(screen.getByRole('link')).toHaveAttribute('href', '/book/a2');
  });

  test('links a page_reaction notification to the reacted-to photo', () => {
    renderItem(reactionNotification);

    expect(screen.getByRole('link')).toHaveAttribute('href', '/book/a1?photo=p1');
  });

  test('renders a page_comment notification as "commented [icon] on a photo in AlbumTitle" with a preview', () => {
    renderItem(commentNotification);

    expect(screen.getByText(/commented/)).toBeInTheDocument();
    expect(screen.getByText('mode_comment')).toBeInTheDocument();
    expect(screen.getByText('Summer Trip')).toBeInTheDocument();
    expect(screen.getByText(/What a lovely photo, I really love the l…/)).toBeInTheDocument();
  });

  test('links a page_comment notification to the commented-on photo', () => {
    renderItem(commentNotification);

    expect(screen.getByRole('link')).toHaveAttribute('href', '/book/a3?photo=p3');
  });

  test('renders a comment_reply notification as "replied [icon] to your comment on a photo in AlbumTitle" with a preview', () => {
    renderItem(replyNotification);

    expect(screen.getByText(/replied/)).toBeInTheDocument();
    expect(screen.getByText('reply')).toBeInTheDocument();
    expect(screen.getByText(/to your comment on a photo in/)).toBeInTheDocument();
    expect(screen.getByText('Summer Trip')).toBeInTheDocument();
    expect(screen.getByText(/Totally agree, the light is amazing!/)).toBeInTheDocument();
  });

  test('links a comment_reply notification to the replied-to photo', () => {
    renderItem(replyNotification);

    expect(screen.getByRole('link')).toHaveAttribute('href', '/book/a4?photo=p4');
  });
});
