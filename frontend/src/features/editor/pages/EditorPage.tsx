import { useState } from 'react';
import { useParams } from 'react-router-dom';
import AppShell from '../../../components/AppShell';
import Icon from '../../../components/Icon';

const TOOLS = [
  { icon: 'add_photo_alternate', label: 'Photo' },
  { icon: 'sticky_note_2', label: 'Note' },
  { icon: 'mic', label: 'Voice' },
  { icon: 'texture', label: 'Texture' },
];

export default function EditorPage() {
  const { id } = useParams();
  const [title, setTitle] = useState(id ? 'The Living Archive' : '');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'shared' | 'public'>('private');

  return (
    <AppShell>
      <div className="lg:flex min-h-full">
        {/* Settings / tool palette */}
        <aside className="lg:w-80 flex-shrink-0 p-gutter lg:p-10 bg-surface-container-low border-b lg:border-b-0 lg:border-r border-outline-variant/40">
          <h2 className="font-display text-headline-md text-on-surface mb-8 border-b border-outline-variant pb-4">
            Album Settings
          </h2>

          <div className="flex flex-col gap-1 mb-8">
            <label className="font-ui text-ui-label uppercase text-on-surface-variant" htmlFor="album-title">
              Volume title
            </label>
            <input
              id="album-title"
              className="line-input w-full py-2 text-body-text"
              placeholder="Name this volume…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1 mb-10">
            <label className="font-ui text-ui-label uppercase text-on-surface-variant" htmlFor="album-desc">
              Description
            </label>
            <textarea
              id="album-desc"
              rows={3}
              className="line-input w-full py-2 text-body-text resize-none"
              placeholder="A few words about this story…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <fieldset className="mb-10">
            <legend className="font-ui text-ui-label uppercase text-on-surface-variant mb-4">
              Privacy
            </legend>
            <div className="flex flex-col gap-3">
              {(
                [
                  ['private', 'lock', 'Private — only you'],
                  ['shared', 'group', 'Shared — family circle'],
                  ['public', 'public', 'Public — community table'],
                ] as const
              ).map(([value, icon, label]) => (
                <label
                  key={value}
                  className={`flex items-center gap-3 px-4 py-3 rounded-paper border cursor-pointer transition-colors font-body text-sm ${
                    visibility === value
                      ? 'border-secondary bg-secondary/5 text-primary'
                      : 'border-outline-variant/50 text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={value}
                    checked={visibility === value}
                    onChange={() => setVisibility(value)}
                    className="sr-only"
                  />
                  <Icon name={icon} className="text-lg" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <h3 className="font-ui text-ui-label uppercase text-on-surface-variant mb-4">Tools</h3>
            <div className="grid grid-cols-4 gap-2">
              {TOOLS.map((tool) => (
                <button
                  key={tool.label}
                  className="flex flex-col items-center gap-1 py-3 rounded-paper border border-outline-variant/40 text-on-surface-variant hover:border-secondary hover:text-secondary transition-colors"
                >
                  <Icon name={tool.icon} />
                  <span className="font-ui text-[10px] uppercase">{tool.label}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* The craft table */}
        <section className="flex-1 p-gutter md:p-margin-edge flex items-center justify-center bg-surface-dim/40">
          <div className="w-full max-w-4xl">
            <div className="grid md:grid-cols-2 bg-surface rounded-card paper-depth overflow-hidden border border-outline-variant/30 min-h-[480px]">
              {/* Left page: placed photo */}
              <div className="relative p-8 md:p-12 border-b md:border-b-0 md:border-r border-outline-variant/40">
                <div className="absolute inset-y-0 right-0 w-2 bg-gradient-to-l from-black/5 to-transparent hidden md:block" />
                <div className="group relative bg-white p-3 pb-10 stuck-photo rotate-[-1deg] max-w-xs mx-auto">
                  <img
                    className="w-full aspect-[4/5] object-cover"
                    alt="Placed memory"
                    src="https://picsum.photos/seed/folia-editor/420/520"
                  />
                  <p className="mt-3 text-center font-body italic text-sm text-on-surface-variant">
                    Grandmother's kitchen, 1963
                  </p>
                  <div className="absolute inset-0 hidden group-hover:flex items-center justify-center gap-3 bg-black/30">
                    <button className="w-10 h-10 rounded-full bg-white text-primary flex items-center justify-center" aria-label="Edit memory">
                      <Icon name="edit" />
                    </button>
                    <button className="w-10 h-10 rounded-full bg-white text-error flex items-center justify-center" aria-label="Remove memory">
                      <Icon name="delete" />
                    </button>
                  </div>
                </div>
                <span className="absolute bottom-4 left-8 font-body italic text-xs text-on-surface-variant/60">
                  page 12
                </span>
              </div>

              {/* Right page: drop zone */}
              <div className="relative p-8 md:p-12 flex items-center justify-center">
                <div className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-black/5 to-transparent hidden md:block" />
                <button className="w-full h-full min-h-[280px] border-2 border-dashed border-outline-variant rounded-card flex flex-col items-center justify-center gap-4 text-on-surface-variant hover:border-secondary hover:text-secondary transition-colors">
                  <Icon name="add_photo_alternate" className="text-5xl" />
                  <span className="font-body italic">Place a memory on this page</span>
                  <span className="font-ui text-ui-label uppercase text-xs">
                    or drag a photo here
                  </span>
                </button>
                <span className="absolute bottom-4 right-8 font-body italic text-xs text-on-surface-variant/60">
                  page 13
                </span>
              </div>
            </div>

            {/* Bottom actions */}
            <div className="mt-8 flex justify-between items-center">
              <span className="font-body italic text-sm text-on-surface-variant">
                All changes kept locally — saving arrives with the flipbooks API.
              </span>
              <button className="bg-secondary text-on-secondary px-8 py-3 rounded-paper font-ui text-ui-button shadow-md hover:opacity-90 active:translate-y-[1px] transition-all flex items-center gap-2">
                <Icon name="save" />
                Save Volume
              </button>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
