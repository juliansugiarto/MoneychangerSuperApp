import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";

const MIN_REASON = 10;

/** Membalik transaksi selesai — hanya Controller ke atas (diperiksa lagi di server). */
export function ReverseTransactionDialog({ transactionId, label, onDone }: { transactionId: number; label: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const reverse = trpc.transactions.reverse.useMutation({
    onSuccess: () => { toast.success("Transaksi dibalik."); setOpen(false); setReason(""); onDone(); },
    onError: (error) => toast.error(error.message),
  });
  const tooShort = reason.trim().length < MIN_REASON;
  return <>
    <Button size="sm" variant="ghost" className="text-rose-700" onClick={() => setOpen(true)}>Balik transaksi</Button>
    <Dialog open={open} onOpenChange={(next) => { if (!reverse.isPending) setOpen(next); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Balik transaksi {label}?</DialogTitle>
          <DialogDescription>
            Kas, lembar uang, dan rekening kembali seperti sebelum transaksi ini. Bisa dilakukan selama buku bulan
            transaksinya masih terbuka dan LKU-nya belum disiapkan.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label htmlFor="reverse-reason">Alasan</Label>
          <Textarea id="reverse-reason" className="mt-1" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Mis. salah input jumlah lembar" />
          {tooShort ? <p className="mt-1 text-xs text-slate-600">Minimal {MIN_REASON} huruf.</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={reverse.isPending} onClick={() => setOpen(false)}>Kembali</Button>
          <Button className="bg-rose-700 hover:bg-rose-800" disabled={tooShort || reverse.isPending} onClick={() => reverse.mutate({ transactionId, reason: reason.trim() })}>
            {reverse.isPending ? "Memproses…" : "Balik transaksi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
