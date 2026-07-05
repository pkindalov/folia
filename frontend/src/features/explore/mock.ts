/** Mock data shaped like a future GET /api/explore response. */
export type CommunityAlbum = {
  _id: string;
  title: string;
  author: string;
  coverColor: string;
  coverImage: string;
  reflections: number;
  bookmarks: number;
};

export const mockCommunityAlbums: CommunityAlbum[] = [
  { _id: 'ca-1', title: 'Summer in the Valley', author: 'Elena Marchetti', coverColor: '#5B6650', coverImage: 'https://picsum.photos/seed/folia-c1/440/560', reflections: 128, bookmarks: 46 },
  { _id: 'ca-2', title: 'Letters from Home', author: 'The Okafor Family', coverColor: '#37414F', coverImage: 'https://picsum.photos/seed/folia-c2/440/560', reflections: 84, bookmarks: 31 },
  { _id: 'ca-3', title: 'The Blue Note Years', author: 'Marcus Reid', coverColor: '#1F2933', coverImage: 'https://picsum.photos/seed/folia-c3/440/560', reflections: 212, bookmarks: 97 },
  { _id: 'ca-4', title: 'Harvest Diaries', author: 'Petrov Household', coverColor: '#6E5A2C', coverImage: 'https://picsum.photos/seed/folia-c4/440/560', reflections: 57, bookmarks: 19 },
  { _id: 'ca-5', title: 'Coastline Memories', author: 'Ana & Luis', coverColor: '#2C4A5A', coverImage: 'https://picsum.photos/seed/folia-c5/440/560', reflections: 143, bookmarks: 62 },
  { _id: 'ca-6', title: 'The Print Shop', author: 'Georgi Danov', coverColor: '#4A3B32', coverImage: 'https://picsum.photos/seed/folia-c6/440/560', reflections: 39, bookmarks: 12 },
];
