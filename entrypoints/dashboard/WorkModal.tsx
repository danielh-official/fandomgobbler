import { createEffect, createResource, createSignal, Match, Show, Switch } from 'solid-js';
import { WorkView } from '@/components/WorkView';
import { SUPPORTED_HINT } from '@/utils/platforms';
import { readWorkUrl } from '@/utils/work-fetch';
import { workKey, type Work } from '@/utils/models';
import { ImportFromAo3 } from './ImportFromAo3';

export type ModalState = { kind: 'edit'; key: string } | { kind: 'add' } | { kind: 'import' } | null;

// Native <dialog> opened with showModal(): Esc, focus trapping and the backdrop come free.
export function WorkModal(props: { state: ModalState; library: Work[]; onClose: () => void }) {
  let dialog!: HTMLDialogElement;
  createEffect(() => {
    if (props.state && !dialog.open) dialog.showModal();
    if (!props.state && dialog.open) dialog.close();
  });

  const editing = () => {
    const s = props.state;
    return s?.kind === 'edit' ? props.library.find((w) => workKey(w) === s.key) : undefined;
  };
  // Untracking the work being edited closes the modal: there's nothing left to edit.
  createEffect(() => props.state?.kind === 'edit' && !editing() && dialog.close());

  return (
    <dialog
      ref={dialog}
      // m-auto restores the native centring that Tailwind's reset removes. Full screen on phones.
      class="m-auto max-h-[calc(100%-32px)] w-[min(560px,calc(100%-32px))] overscroll-contain rounded-xl bg-bg p-0 text-text shadow-[0_16px_48px_rgb(0_0_0/0.2)] backdrop:bg-black/35 max-md:m-0 max-md:h-full max-md:max-h-none max-md:w-full max-md:max-w-none max-md:rounded-none"
      onClose={() => props.onClose()}
      // A click on the dialog element itself (not its content) is a click on the backdrop.
      onClick={(e) => e.target === dialog && dialog.close()}
    >
      <div class="relative grid gap-3 px-4 pt-11 pb-4">
        <button
          class="absolute top-2 right-2.5 border-0 bg-transparent px-2 py-1 text-lg"
          onClick={() => dialog.close()}
          aria-label="Close"
        >
          ✕
        </button>
        <Show when={props.state?.kind === 'add'}>
          <AddWork library={props.library} />
        </Show>
        <Show when={props.state?.kind === 'import'}>
          <ImportFromAo3 />
        </Show>
        <Show when={editing()}>{(w) => <WorkView work={w()} tracked={w()} />}</Show>
      </div>
    </dialog>
  );
}

// Fetches the one work the user pasted, then shows it so they can pick a status.
function AddWork(props: { library: Work[] }) {
  const [url, setUrl] = createSignal<string | null>(null);
  const [work] = createResource(url, readWorkUrl);

  return (
    <div class="grid gap-3">
      <h2 class="text-base font-bold">Add a work</h2>
      <form
        class="grid gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem('url') as HTMLInputElement;
          setUrl(input.value.trim());
        }}
      >
        <div class="flex gap-1.5">
          <input class="flex-1" name="url" type="url" required autofocus placeholder="Paste a work url" />
          <button disabled={work.loading}>Look up</button>
        </div>
        <p class="text-xs text-muted">{SUPPORTED_HINT}</p>
      </form>
      <Switch>
        <Match when={work.loading}>
          <p class="text-muted">Loading…</p>
        </Match>
        <Match when={work.error}>
          <p class="text-danger">{(work.error as Error).message}</p>
        </Match>
        <Match when={work()}>
          {(w) => (
            <>
              <Show when={!props.library.some((t) => workKey(t) === workKey(w()))}>
                <p class="text-xs text-muted">Pick a status to add it to your library.</p>
              </Show>
              <WorkView work={w()} tracked={props.library.find((t) => workKey(t) === workKey(w()))} />
            </>
          )}
        </Match>
      </Switch>
    </div>
  );
}
