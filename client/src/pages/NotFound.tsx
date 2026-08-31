import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Compass, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#f4f6fb] px-4">
      <Card className="mx-auto w-full max-w-lg border-[#dce6f0] shadow-[0_22px_60px_rgba(16,47,88,0.1)]">
        <CardContent className="px-8 py-10 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#e8f0fb] text-[#18395f]">
            <Compass className="size-6" />
          </div>
          <p className="mt-6 font-display text-5xl font-bold tracking-tight text-[#18395f]">404</p>
          <h1 className="mt-2 font-display text-xl font-semibold text-[#18395f]">Halaman tidak ditemukan</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#64748b]">
            Halaman yang kamu tuju mungkin sudah dipindahkan, tidak tersedia untuk peran akunmu, atau alamatnya keliru diketik.
          </p>
          <Button onClick={() => setLocation("/operasional")} className="press-scale mt-8 bg-[#183f70] text-white hover:bg-[#12345d]">
            <Home className="mr-2 size-4" />
            Kembali ke Beranda Operasional
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
