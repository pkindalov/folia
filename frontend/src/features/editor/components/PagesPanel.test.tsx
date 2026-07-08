import { describe, test, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PagesPanel from './PagesPanel';

function photo(id: string, filename: string) {
  return { _id: id, url: `/uploads/${filename}`, filename, caption: '' };
}

const baseProps = {
  locked: false,
  isUploading: false,
  rejections: [],
  onFilesSelected: () => {},
  onRemovePhoto: () => {},
  onSetCoverPhoto: () => {},
  onDismissRejections: () => {},
  onCaptionChange: () => {},
};

describe('PagesPanel', () => {
  test('closes the lightbox rather than reopening a different photo once the open one is removed', async () => {
    const user = userEvent.setup();
    const initialPhotos = [photo('p1', 'one.jpg'), photo('p2', 'two.jpg')];

    const { rerender } = render(<PagesPanel {...baseProps} photos={initialPhotos} />);

    // Open the lightbox on the last photo.
    await user.click(screen.getByRole('button', { name: /view two\.jpg full size/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Photo viewer' });
    expect(within(dialog).getByAltText('two.jpg')).toBeInTheDocument();

    // The open photo is removed elsewhere (e.g. a delete succeeds and the
    // parent's pagesQuery refetches with one less item).
    rerender(<PagesPanel {...baseProps} photos={[photo('p1', 'one.jpg')]} />);
    expect(screen.queryByRole('dialog', { name: 'Photo viewer' })).not.toBeInTheDocument();

    // A new, unrelated photo is uploaded, growing the array back to the
    // same length the removed photo used to occupy.
    rerender(
      <PagesPanel {...baseProps} photos={[photo('p1', 'one.jpg'), photo('p3', 'three.jpg')]} />
    );

    // The lightbox must stay closed — it should never reopen on its own
    // showing a photo the user never clicked.
    expect(screen.queryByRole('dialog', { name: 'Photo viewer' })).not.toBeInTheDocument();
  });
});
