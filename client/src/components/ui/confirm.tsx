/**
 * A real confirmation dialog, and the hook that makes it a drop-in for
 * `window.confirm`.
 *
 * There were 17 destructive actions in this app gated by a native
 * `window.confirm()`, including "reset all PTO balances? This cannot be undone"
 * — a mass, irreversible write to every employee's leave, one Enter keypress
 * from happening. Native confirm cannot be styled, renders as a system alert
 * branded with the origin when the app is installed as a PWA, and gives a
 * destructive action exactly the same weight as a benign one.
 *
 * Usage mirrors what it replaces, so the call sites stay one-liners:
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: 'Delete this territory?' }))) return;
 *
 * For the handful of actions that are irreversible AND wide, pass `typeToConfirm`
 * and the user has to type the word before the button enables:
 *
 *   await confirm({ title: 'Reset all PTO balances?', typeToConfirm: 'RESET' })
 */
import * as React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type ConfirmOptions = {
  title: string;
  /** One line on what actually happens. Say the consequence, not "are you sure". */
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red button. Default true, because every current caller is destructive. */
  destructive?: boolean;
  /** Require this exact string to be typed first. For irreversible bulk writes. */
  typeToConfirm?: string;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

const ConfirmContext = React.createContext<((o: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [typed, setTyped] = React.useState('');

  const confirm = React.useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setTyped('');
        setPending({ ...options, resolve });
      }),
    [],
  );

  const settle = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
    setTyped('');
  };

  const gateOpen = !pending?.typeToConfirm || typed.trim() === pending.typeToConfirm;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={pending !== null} onOpenChange={(open) => { if (!open) settle(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
            {pending?.description ? (
              <AlertDialogDescription>{pending.description}</AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>

          {pending?.typeToConfirm ? (
            <div className="space-y-2">
              <Label htmlFor="confirm-phrase">
                Type <span className="font-mono font-semibold">{pending.typeToConfirm}</span> to continue
              </Label>
              <Input
                id="confirm-phrase"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                aria-describedby="confirm-phrase-help"
              />
              <p id="confirm-phrase-help" className="sr-only">
                This action cannot be undone, so it must be confirmed by typing.
              </p>
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => settle(false)}>
              {pending?.cancelLabel ?? 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!gateOpen}
              onClick={(e) => {
                if (!gateOpen) { e.preventDefault(); return; }
                settle(true);
              }}
              className={
                pending?.destructive === false
                  ? undefined
                  : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              }
            >
              {pending?.confirmLabel ?? 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used inside <ConfirmProvider>. It is mounted in App.tsx.');
  }
  return ctx;
}
