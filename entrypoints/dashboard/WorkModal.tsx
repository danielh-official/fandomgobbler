import { createEffect, createResource, createSignal, Match, Show, Switch } from 'solid-js';
import { WorkView } from '@/components/WorkView';
import { ao3WorkId } from '@/utils/ao3';
import { fetchAo3Work, refreshIfTracked } from '@/utils/ao3-fetch';
import type { Ao3Work } from '@/utils/models';

export type ModalState = { kind: 'edit'; id: string } | { kind: 'add' } | null;

// Native <dialog> opened with showModal(): Esc, focus trapping and the backdrop come free.
export function WorkModal(props: { state: ModalState; library: Ao3Work[]; onClose: () => void }) {
  let dialog!: HTMLDialogElement;
  createEffect(() => {
    if (props.state && !dialog.open) dialog.showModal();
    if (!props.state && dialog.open) dialog.close();
  });

  const editing = () => {
    const s = props.state;
    return s?.kind === 'edit' ? props.library.find((w) => w.id === s.id) : undefined;
  };
  // Untracking the work being edited closes the modal: there's nothing left to edit.
  createEffect(() => props.state?.kind === 'edit' && !editing() && dialog.close());

  return (
    <dialog
      ref={dialog}
      class="modal"
      onClose={props.onClose}
      // A click on the dialog element itself (not its content) is a click on the backdrop.
      onClick={(e) => e.target === dialog && dialog.close()}
    >
      <div class="modal-body">
        <button class="modal-close" onClick={() => dialog.close()} aria-label="Close">
          ✕
        </button>
        <Show when={props.state?.kind === 'add'}>
          <AddWork library={props.library} />
        </Show>
        <Show when={editing()}>{(w) => <WorkView work={w()} tracked={w()} />}</Show>
      </div>
    </dialog>
  );
}

// Fetches the one work the user pasted, then shows it so they can pick a status.
function AddWork(props: { library: Ao3Work[] }) {
  const [url, setUrl] = createSignal<string | null>(null);
  const [work] = createResource(url, async (u) => {
    const id = ao3WorkId(u);
    if (!id) throw new Error('That isn’t an AO3 work URL.');
    const w = await fetchAo3Work(id);
    await refreshIfTracked(w);
    return w;
  });

  return (
    <div class="add-work">
      <h2 class="modal-title">Add a work</h2>
      <form
        class="url-form"
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem('url') as HTMLInputElement;
          setUrl(input.value.trim());
        }}
      >
        <input name="url" type="url" required autofocus placeholder="Paste an AO3 work URL" />
        <button disabled={work.loading}>Look up</button>
      </form>
      <Switch>
        <Match when={work.loading}>
          <p class="muted">Loading from AO3…</p>
        </Match>
        <Match when={work.error}>
          <p class="error">{(work.error as Error).message}</p>
        </Match>
        <Match when={work()}>
          {(w) => (
            <>
              <Show when={!props.library.some((t) => t.id === w().id)}>
                <p class="muted small">Pick a status to add it to your library.</p>
              </Show>
              <WorkView work={w()} tracked={props.library.find((t) => t.id === w().id)} />
            </>
          )}
        </Match>
      </Switch>
    </div>
  );
}
