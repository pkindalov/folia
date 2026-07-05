/** Mock data shaped like a future GET /api/archive response. */
export type ArchivedVolume = {
  _id: string;
  title: string;
  years: string;
  spineColor: string;
  pageCount: number;
};

export const mockArchivedVolumes: ArchivedVolume[] = [
  { _id: 'av-1', title: 'The Founding Years', years: '1948–1955', spineColor: '#4A2C1D', pageCount: 64 },
  { _id: 'av-2', title: 'Voyages', years: '1956–1963', spineColor: '#1E2A3A', pageCount: 48 },
  { _id: 'av-3', title: 'The Green House', years: '1964–1971', spineColor: '#2C4A33', pageCount: 52 },
  { _id: 'av-4', title: 'City Lights', years: '1972–1980', spineColor: '#8a4b25', pageCount: 71 },
  { _id: 'av-5', title: 'Quiet Decades', years: '1981–1994', spineColor: '#141414', pageCount: 39 },
  { _id: 'av-6', title: 'New Branches', years: '1995–2008', spineColor: '#3d3d46', pageCount: 58 },
  { _id: 'av-7', title: 'The Digital Turn', years: '2009–2020', spineColor: '#5a2331', pageCount: 44 },
];
