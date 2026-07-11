import { describe, test, expect } from 'vitest';
import { useRef } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import useFocusTrap from './useFocusTrap';

function TestDialog({ isActive }: { isActive: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, isActive);

  return (
    <div>
      <button>Outside</button>
      <div ref={containerRef}>
        <button>First</button>
        <button>Second</button>
        <button>Last</button>
      </div>
    </div>
  );
}

// Covers the edge case of a trapped container with zero focusable
// descendants (e.g. a panel that hasn't rendered its dismiss control yet).
function TestEmptyDialog({ isActive }: { isActive: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, isActive);

  return (
    <div>
      <div ref={containerRef}>
        <span>Read-only content</span>
      </div>
      <button>After</button>
    </div>
  );
}

describe('useFocusTrap', () => {
  test('moves focus to the first focusable element when activated', () => {
    render(<TestDialog isActive />);
    expect(screen.getByText('First')).toHaveFocus();
  });

  test('wraps Tab from the last element back to the first', () => {
    render(<TestDialog isActive />);
    screen.getByText('Last').focus();
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
    expect(screen.getByText('First')).toHaveFocus();
  });

  test('wraps Shift+Tab from the first element back to the last', () => {
    render(<TestDialog isActive />);
    expect(screen.getByText('First')).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'Tab', shiftKey: true });
    expect(screen.getByText('Last')).toHaveFocus();
  });

  test('restores focus to the previously focused element on unmount', () => {
    const outsideButton = document.createElement('button');
    outsideButton.textContent = 'Trigger';
    document.body.appendChild(outsideButton);
    outsideButton.focus();

    const { unmount } = render(<TestDialog isActive />);
    expect(screen.getByText('First')).toHaveFocus();

    unmount();
    expect(outsideButton).toHaveFocus();
    outsideButton.remove();
  });

  test('does nothing when inactive', () => {
    const outsideButton = document.createElement('button');
    document.body.appendChild(outsideButton);
    outsideButton.focus();

    render(<TestDialog isActive={false} />);
    expect(outsideButton).toHaveFocus();
    outsideButton.remove();
  });

  test('does not trap Tab when the container has no focusable content', () => {
    render(<TestEmptyDialog isActive />);

    // fireEvent.keyDown returns false when a listener called
    // preventDefault() — asserting true confirms Tab was left free to fall
    // through to its default (focus-moving) behavior instead of being
    // blocked with nowhere for focus to go.
    const notPrevented = fireEvent.keyDown(document.activeElement!, { key: 'Tab' });

    expect(notPrevented).toBe(true);
  });
});
