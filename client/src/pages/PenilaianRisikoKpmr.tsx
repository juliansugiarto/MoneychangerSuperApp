import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  IRA_FINAL_VALUE_MATRIX,
  IRA_KPMR_PILLAR_WEIGHTS_DISPLAY_ONLY,
  kpmrPillarAverage,
  type IraInherentPredicate,
  type IraKpmrPredicate,
} from "@shared/individualRiskAssessment";
import { computeAssessmentTotals, type KpmrAnswerInput } from "@shared/iraAssessmentTotals";
import { IRA_KPMR_PILLARS, IRA_KPMR_PILLAR_LABELS, questionsOfPillar } from "@shared/iraKpmrCatalogue";
import { AlertTriangle, ArrowLeft, Flag, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useParams } from "wouter";

/**
 * Kuesioner KPMR — 31 pertanyaan lima pilar — beserta hasil penilaiannya.
 *
 * Rata-rata tiap pilar tampil hidup **beserta pembaginya**: N/A mengubah pembagi tanpa mengubah
 * tampilan hasilnya, sehingga angka rata-rata saja tidak dapat dipercaya oleh yang membacanya.
 *
 * Aritmetikanya memakai `computeAssessmentTotals` yang sama persis dengan yang membekukan nilai
 * saat disetujui — bukan salinan rumus untuk layar.
 */

const PREDICATE_LABEL: Record<string, string> = {
  TINGGI: "Tinggi",
  MENENGAH_KE_TINGGI: "Menengah ke Tinggi",
  MENENGAH: "Menengah",
  RENDAH_KE_MENENGAH: "Rendah ke Menengah",
  RENDAH: "Rendah",
  UNSATISFACTORY: "Unsatisfactory",
  MARGINAL: "Marginal",
  FAIR: "Fair",
  SATISFACTORY: "Satisfactory",
  STRONG: "Strong",
};

const INHERENT_ROWS = Object.keys(IRA_FINAL_VALUE_MATRIX) as IraInherentPredicate[];
const KPMR_COLUMNS = Object.keys(IRA_FINAL_VALUE_MATRIX.TINGGI) as IraKpmrPredicate[];

/** `null` = N/A (jawaban sah), `undefined` = belum dijawab. Keduanya berbeda dan tidak boleh disamakan. */
type Draft = Record<string, number | null | undefined>;

export default function PenilaianRisikoKpmr() {
  const params = useParams<{ id: string }>();
  const assessmentId = Number(params.id);
  const utils = trpc.useUtils();

  const detail = trpc.ira.detail.useQuery({ id: assessmentId }, { enabled: Number.isFinite(assessmentId) });
  const [draft, setDraft] = useState<Draft>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [references, setReferences] = useState<Record<string, string>>({});

  const save = trpc.ira.saveKpmr.useMutation({
    onSuccess: () => {
      toast.success("Jawaban kuesioner disimpan.");
      void utils.ira.detail.invalidate({ id: assessmentId });
    },
    onError: (error) => toast.error(error.message),
  });

  if (detail.isPending) {
    return <div className="space-y-3">{[0, 1, 2, 3].map((row) => <Skeleton key={row} className="h-24 w-full" />)}</div>;
  }

  if (detail.isError) {
    return (
      <div className="rounded-2xl border border-[#f0d6d6] bg-[#fdf6f6] px-5 py-6 text-sm leading-6 text-[#9a4b4b]">
        <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4" /> Kuesioner gagal dimuat.</p>
        <p className="mt-1">{detail.error.message}</p>
        <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void detail.refetch()}>Coba lagi</Button>
      </div>
    );
  }

  const assessment = detail.data.assessment as { status: "DRAFT" | "MENUNGGU_PERSETUJUAN" | "DISETUJUI" };
  const locked = assessment.status === "DISETUJUI";
  const stored = new Map((detail.data.answers as KpmrAnswerInput[]).map((row) => [row.questionCode, row]));
  const values = detail.data.values as Parameters<typeof computeAssessmentTotals>[0];

  const answerOf = (code: string): number | null | undefined => {
    if (code in draft) return draft[code];
    const row = stored.get(code);
    if (!row || !row.answered) return undefined;
    return row.score;
  };
  const noteOf = (code: string) => notes[code] ?? stored.get(code)?.note ?? "";
  const referenceOf = (code: string) => references[code] ?? stored.get(code)?.documentReference ?? "";

  const answered = (): KpmrAnswerInput[] =>
    IRA_KPMR_PILLARS.flatMap((pillar) =>
      questionsOfPillar(pillar).flatMap((question) => {
        const value = answerOf(question.code);
        if (value === undefined) return [];
        return [{
          questionCode: question.code,
          answered: true,
          score: value,
          note: noteOf(question.code).trim() || null,
          documentReference: referenceOf(question.code).trim() || null,
        }];
      }),
    );

  const unanswered = IRA_KPMR_PILLARS.reduce(
    (total, pillar) => total + questionsOfPillar(pillar).filter((question) => answerOf(question.code) === undefined).length,
    0,
  );

  // Hasil sementara hanya dapat dihitung ketika seluruhnya lengkap; selebihnya yang ditampilkan
  // adalah berapa yang masih kurang, bukan angka yang separuhnya karangan.
  let totals: ReturnType<typeof computeAssessmentTotals> | null = null;
  let totalsError: string | null = null;
  try {
    totals = computeAssessmentTotals(values, answered());
  } catch (error) {
    totalsError = error instanceof Error ? error.message : String(error);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/kepatuhan/ira/${assessmentId}`}>
          <Button type="button" variant="outline" size="sm"><ArrowLeft className="mr-1 size-4" /> Kembali ke penilaian</Button>
        </Link>
        {locked ? (
          <Badge variant="outline" className="border-[#cfe3cb] bg-[#f2f8f1] text-[#4a7a43]"><Lock className="mr-1 size-3" /> Terkunci — sudah disetujui</Badge>
        ) : (
          <Button type="button" disabled={save.isPending || answered().length === 0} onClick={() => save.mutate({ assessmentId, answers: answered() })}>
            Simpan jawaban
          </Button>
        )}
      </div>

      <Card className="border-[#e4e9f0]">
        <CardHeader>
          <CardTitle className="text-[#18395f]">Hasil penilaian</CardTitle>
          <CardDescription>
            Nilai akhir mengikuti matriks Bank Indonesia: baris predikat risiko inheren, kolom predikat KPMR.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {totals ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[#e4e9f0] bg-[#f9fbfd] px-4 py-3">
                  <p className="text-xs text-[#94a7bb]">Risiko inheren</p>
                  <p className="text-lg font-semibold text-[#18395f]">{Number(totals.inherentScore).toFixed(4)} · {PREDICATE_LABEL[totals.inherentPredicate]}</p>
                </div>
                <div className="rounded-xl border border-[#e4e9f0] bg-[#f9fbfd] px-4 py-3">
                  <p className="text-xs text-[#94a7bb]">KPMR</p>
                  <p className="text-lg font-semibold text-[#18395f]">{Number(totals.kpmrScore).toFixed(4)} · {PREDICATE_LABEL[totals.kpmrPredicate]}</p>
                </div>
                <div className="rounded-xl border border-[#cfe3cb] bg-[#f2f8f1] px-4 py-3">
                  <p className="text-xs text-[#6f8f6a]">Nilai akhir</p>
                  <p className="text-lg font-semibold text-[#2f5a2a]">{totals.finalValue} · {PREDICATE_LABEL[totals.finalPredicate]}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[620px] text-left text-sm">
                  <thead className="text-xs tracking-[0.12em] text-[#94a7bb] uppercase">
                    <tr>
                      <th className="px-3 py-2">Inheren \ KPMR</th>
                      {KPMR_COLUMNS.map((column) => <th key={column} className="px-3 py-2 text-center">{PREDICATE_LABEL[column]}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf0f5]">
                    {INHERENT_ROWS.map((row) => (
                      <tr key={row}>
                        <td className="px-3 py-2 font-semibold text-[#18395f] whitespace-nowrap">{PREDICATE_LABEL[row]}</td>
                        {KPMR_COLUMNS.map((column) => {
                          const selected = row === totals!.inherentPredicate && column === totals!.kpmrPredicate;
                          return (
                            <td
                              key={column}
                              className={`px-3 py-2 text-center ${selected ? "rounded-lg bg-[#18395f] font-semibold text-white" : "text-[#475569]"}`}
                            >
                              {IRA_FINAL_VALUE_MATRIX[row][column]}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-[#f0e2c4] bg-[#fdf9f0] px-5 py-6 text-sm leading-6 text-[#8a6d2f]">
              <p className="font-semibold">Nilai akhir belum dapat dihitung.</p>
              <p className="mt-1">{totalsError}</p>
              {unanswered > 0 ? <p className="mt-1">{unanswered} pertanyaan KPMR belum dijawab.</p> : null}
            </div>
          )}
        </CardContent>
      </Card>

      {IRA_KPMR_PILLARS.map((pillar) => {
        const questions = questionsOfPillar(pillar);
        const scores = questions.map((question) => answerOf(question.code)).filter((value) => value !== undefined) as (number | null)[];
        const counted = scores.filter((value) => value !== null).length;
        const average = scores.length > 0 ? kpmrPillarAverage(scores) : null;
        return (
          <Card key={pillar} className="border-[#e4e9f0]">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-baseline justify-between gap-2 text-[#18395f]">
                <span>{IRA_KPMR_PILLAR_LABELS[pillar]}</span>
                <span className="text-sm font-normal text-[#475569]">
                  Rata-rata pilar:{" "}
                  <strong className="text-[#18395f]">{average ? Number(average.toString()).toFixed(4) : "—"}</strong>{" "}
                  {/* Pembaginya ditampilkan: N/A mengubah pembagi tanpa mengubah tampilan hasilnya. */}
                  <span className="text-[#94a7bb]">dari {counted} jawaban yang ikut dihitung, {questions.length} pertanyaan</span>
                </span>
              </CardTitle>
              <CardDescription>
                Bobot pilar pada lembar Rekap {Number(IRA_KPMR_PILLAR_WEIGHTS_DISPLAY_ONLY[pillar]) * 100}% — keterangan saja;
                nilai KPMR adalah rata-rata sederhana kelima pilar, sesuai rumus templatnya.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {questions.map((question) => {
                const value = answerOf(question.code);
                return (
                  <div key={question.code} className="rounded-xl border border-[#e4e9f0] bg-[#f9fbfd] px-4 py-3">
                    <div className="flex flex-wrap items-start gap-2">
                      <span className="font-semibold text-[#18395f]">{question.number}.</span>
                      <p className="flex-1 text-sm text-[#334155]">{question.question}</p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {question.relatedFindings.map((finding) => (
                        <Badge key={finding} variant="outline" className="border-[#f0d6d6] bg-[#fdf6f6] text-[10px] text-[#9a4b4b]">
                          <Flag className="mr-1 size-3" /> Temuan pemeriksaan {finding}
                        </Badge>
                      ))}
                      {!question.applicableToKupvaBb ? (
                        <Badge variant="outline" className="border-[#dce6f0] bg-[#f7fafd] text-[10px] text-[#4a6a8f]">
                          Tidak berlaku bagi KUPVA BB — jawab N/A
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[140px_1fr_220px]">
                      <Select
                        value={value === undefined ? "" : value === null ? "NA" : String(value)}
                        disabled={locked}
                        onValueChange={(next) => setDraft((current) => ({ ...current, [question.code]: next === "NA" ? null : Number(next) }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Belum dijawab" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 — strong</SelectItem>
                          <SelectItem value="4">4 — satisfactory</SelectItem>
                          <SelectItem value="3">3 — fair</SelectItem>
                          <SelectItem value="2">2 — marginal</SelectItem>
                          <SelectItem value="1">1 — unsatisfactory</SelectItem>
                          <SelectItem value="NA">N/A — tidak berlaku</SelectItem>
                        </SelectContent>
                      </Select>
                      <Textarea
                        rows={2}
                        disabled={locked}
                        placeholder="Catatan penilai"
                        value={noteOf(question.code)}
                        onChange={(event) => setNotes((current) => ({ ...current, [question.code]: event.target.value }))}
                      />
                      <Input
                        disabled={locked}
                        placeholder="Rujukan dokumen"
                        value={referenceOf(question.code)}
                        onChange={(event) => setReferences((current) => ({ ...current, [question.code]: event.target.value }))}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
