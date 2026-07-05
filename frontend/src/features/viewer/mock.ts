/** Mock data shaped like a future GET /api/flipbooks/:id/pages response. */
export type FlipbookPage = {
  photo: string;
  caption: string;
  reflections: { author: string; text: string; when: string }[];
};

export const mockBook = {
  title: 'The Living Archive',
  pages: [
    {
      photo: 'https://picsum.photos/seed/folia-p1/560/700',
      caption: 'The valley house, the summer everyone came home. You can almost hear the cicadas.',
      reflections: [
        { author: 'Elena', text: 'I remember this porch — the boards creaked a tune of their own.', when: '3 days ago' },
        { author: 'Marcus', text: 'Grandpa built that railing the same year I was born.', when: '2 days ago' },
        { author: 'Ana', text: 'Someone should scan the picnic photos from this day too!', when: 'yesterday' },
      ],
    },
    {
      photo: 'https://picsum.photos/seed/folia-p2/560/700',
      caption: 'A letter that crossed two borders and a decade to arrive. Worth every year.',
      reflections: [
        { author: 'Georgi', text: 'The handwriting is my great-aunt’s — steady as a metronome.', when: 'last week' },
      ],
    },
    {
      photo: 'https://picsum.photos/seed/folia-p3/560/700',
      caption: 'First day at the print shop. The smell of ink never really left his coat.',
      reflections: [
        { author: 'Elena', text: 'That press is still running in the museum downtown.', when: '5 days ago' },
        { author: 'Luis', text: 'The apron hangs in our hallway now.', when: '4 days ago' },
      ],
    },
  ] as FlipbookPage[],
};
