import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Catches a route chunk that fails to load.
 *
 * This app is split into ~40 lazy chunks whose filenames carry a content hash.
 * Someone who leaves a tab open across a deploy — which in an HR tool is most
 * people, most days — still holds the old module graph in memory. Clicking a
 * route they have not visited yet requests a hash that no longer exists on the
 * server, the import rejects, and Suspense never resolves.
 *
 * Without this the user sees a permanently blank panel and no error, and the
 * server-side healthcheck stays green throughout, because nothing is wrong with
 * the server. Reloading fixes it, but nothing tells them to.
 *
 * A failed dynamic import is the one error worth handling automatically: the
 * fix is always a reload, and the cause is always a deploy. It reloads once
 * (guarded by sessionStorage, so a genuinely broken build cannot put the tab in
 * a refresh loop) and shows a real message if that did not help.
 */
const RELOAD_FLAG = 'roofhr:chunk-reload';

function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /ChunkLoadError/i.test(message)
  );
}

type Props = { children: ReactNode };
type State = { error: Error | null };

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    if (!isChunkLoadError(error)) {
      console.error('[route] render failed', error);
      return;
    }

    // Reload once. The flag survives the reload and is cleared on the next
    // successful render, so a build that is actually broken shows the message
    // below instead of reloading forever.
    if (sessionStorage.getItem(RELOAD_FLAG)) return;
    try {
      sessionStorage.setItem(RELOAD_FLAG, '1');
    } catch {
      return; // private mode: fall through to the message rather than loop
    }
    window.location.reload();
  }

  componentDidMount() {
    try {
      sessionStorage.removeItem(RELOAD_FLAG);
    } catch {
      /* nothing to clear */
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const stale = isChunkLoadError(error);
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-semibold">
          {stale ? 'This page needs a refresh' : "That page didn't load"}
        </h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {stale
            ? 'Roof HR was updated while this tab was open. Reloading picks up the new version. Nothing you were working on has been lost.'
            : 'Something went wrong rendering this page. Your data is fine.'}
        </p>
        <div className="mt-6 flex gap-3">
          <Button onClick={() => window.location.reload()}>Reload</Button>
          <Button variant="outline" onClick={() => this.setState({ error: null })}>
            Try again
          </Button>
        </div>
      </div>
    );
  }
}
