import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/**
 * Confirms permanent school deletion (replaces window.confirm).
 */
export function DeleteSchoolConfirmDialog({ school, deleting, onCancel, onConfirm }) {
  const open = Boolean(school);
  const name = school?.name ?? '';

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onCancel(); }}>
      <DialogContent className="max-w-md sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-900">Delete school?</DialogTitle>
          <DialogDescription className="text-slate-600 pt-1 text-left">
            Delete{' '}
            <span className="font-semibold text-slate-800">{name}</span>
            ? This removes all data tied to this school. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-end flex-col-reverse sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="border-slate-200 rounded-xl"
            onClick={onCancel}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="rounded-xl bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500"
            onClick={() => onConfirm()}
            disabled={deleting}
          >
            {deleting ? 'Deleting…' : 'Delete school'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
