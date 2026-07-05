/** Mock data shaped like a future GET /api/flipbooks response. */
export type Flipbook = {
  _id: string;
  title: string;
  subtitle: string;
  coverColor: string;
  coverImage?: string;
  pageCount: number;
  visibility: 'private' | 'public' | 'shared';
  updatedAt: string;
};

export const mockFlipbooks: Flipbook[] = [
  {
    _id: 'fb-1',
    title: 'The Living Archive',
    subtitle: 'Family chronicle, est. 1948',
    coverColor: '#4A3B32',
    coverImage: 'https://picsum.photos/seed/folia-b1/400/520',
    pageCount: 42,
    visibility: 'shared',
    updatedAt: '2026-06-28T10:00:00Z',
  },
  {
    _id: 'fb-2',
    title: 'Summer in the Valley',
    subtitle: 'Holidays 2025',
    coverColor: '#5B6650',
    coverImage: 'https://picsum.photos/seed/folia-b2/400/520',
    pageCount: 18,
    visibility: 'public',
    updatedAt: '2026-06-12T10:00:00Z',
  },
  {
    _id: 'fb-3',
    title: 'Letters from Home',
    subtitle: 'Correspondence 1952–1961',
    coverColor: '#37414F',
    pageCount: 27,
    visibility: 'private',
    updatedAt: '2026-05-30T10:00:00Z',
  },
  {
    _id: 'fb-4',
    title: 'The Blue Note Years',
    subtitle: "Grandpa's jazz clippings",
    coverColor: '#1F2933',
    coverImage: 'https://picsum.photos/seed/folia-b4/400/520',
    pageCount: 35,
    visibility: 'shared',
    updatedAt: '2026-04-02T10:00:00Z',
  },
  {
    _id: 'fb-5',
    title: 'Wedding of E & M',
    subtitle: 'June 1978',
    coverColor: '#6E3B2C',
    pageCount: 24,
    visibility: 'private',
    updatedAt: '2026-03-15T10:00:00Z',
  },
];

export const VISIBILITY_ICON: Record<Flipbook['visibility'], string> = {
  private: 'lock',
  public: 'public',
  shared: 'group',
};
