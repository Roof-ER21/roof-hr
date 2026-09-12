import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

/**
 * Wired as the catch-all in App.tsx. It previously existed but no route
 * rendered it, so a mistyped URL fell through to a blank screen — and its copy
 * read "Did you forget to add the page to the router?", which is a message for
 * whoever wrote the code, not for the person who mistyped a link.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="mt-2 text-2xl font-semibold">That page isn't here</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        The link may be out of date, or you may not have access to it. Nothing has gone wrong with
        your account.
      </p>
      <div className="mt-6 flex gap-3">
        <Button asChild>
          <Link to="/my-portal">Go to my portal</Link>
        </Button>
        <Button variant="outline" onClick={() => window.history.back()}>
          Go back
        </Button>
      </div>
    </div>
  );
}
