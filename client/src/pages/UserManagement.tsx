import { useAuth } from "@/_core/hooks/useAuth";
import { DataTable, type Column } from "@/components/patterns/DataTable";
import { FormSection } from "@/components/patterns/FormSection";
import { ListDetailLayout } from "@/components/patterns/ListDetailLayout";
import { PageHeader } from "@/components/patterns/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/patterns/PageStates";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { ROLE_LABELS, accountDisplayName, type InternalAccount } from "./users/accounts";
import { CreateUserForm } from "./users/CreateUserForm";
import { ResetPasswordDialog } from "./users/ResetPasswordDialog";
import { UserDetail } from "./users/UserDetail";

const columns: Column<InternalAccount>[] = [
  { key: "nama", header: "Nama", cell: (account) => accountDisplayName(account) },
  { key: "username", header: "Username", cell: (account) => `@${account.username}` },
  { key: "peran", header: "Peran", cell: (account) => ROLE_LABELS[account.role] ?? account.role },
  { key: "status", header: "Status", cell: (account) => (account.accountStatus === "ACTIVE" ? "Aktif" : "Nonaktif") },
];

export default function UserManagement() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const accounts = trpc.users.list.useQuery();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const refresh = () => utils.users.list.invalidate();
  const create = trpc.users.create.useMutation({ onSuccess: () => { toast.success("Akun dibuat. Pengguna wajib mengganti kata sandi saat pertama masuk."); void refresh(); }, onError: (error) => toast.error(error.message) });
  const setRole = trpc.users.setRole.useMutation({ onSuccess: () => { toast.success("Peran diubah dan sesi akun dicabut."); void refresh(); }, onError: (error) => toast.error(error.message) });
  const setStatus = trpc.users.setStatus.useMutation({ onSuccess: () => { toast.success("Status akun diubah dan sesinya dicabut."); void refresh(); }, onError: (error) => toast.error(error.message) });
  const resetPassword = trpc.users.resetPassword.useMutation({ onSuccess: () => { setResetOpen(false); toast.success("Kata sandi direset. Pengguna wajib menggantinya saat masuk."); void refresh(); }, onError: (error) => toast.error(error.message) });
  const selected = accounts.data?.find((account) => account.id === selectedId) ?? null;
  const requestedRole = new URLSearchParams(window.location.search).get("role");
  const initialRole = requestedRole === "ADMIN" ? "ADMIN" : "STAFF";

  const list = accounts.isLoading ? <LoadingState label="Memuat akun…" />
    : accounts.isError ? <ErrorState what="Daftar akun tidak dapat dimuat." nextStep="Periksa sambungan, lalu coba lagi." onRetry={() => accounts.refetch()} />
    : !accounts.data?.length ? <EmptyState title="Belum ada akun lain" nextStep="Buat akun Staf atau Admin pertama dengan formulir di bawah." />
    : <DataTable caption="Akun internal" columns={columns} rows={accounts.data} rowKey={(account) => String(account.id)} selectedKey={selectedId === null ? null : String(selectedId)} onSelect={(account) => setSelectedId(account.id)} />;

  return (
    <div>
      <PageHeader title="Siapa saja yang boleh masuk?" description="Buat akun, atur peran, nonaktifkan, atau reset kata sandi. Setiap perubahan langsung mencabut sesi akun yang dituju." />
      <ListDetailLayout
        list={list}
        detailTitle={selected ? accountDisplayName(selected) : undefined}
        onCloseDetail={() => setSelectedId(null)}
        detail={selected ? (
          <UserDetail
            account={selected}
            onRoleChange={(role) => setRole.mutate({ userId: selected.id, role })}
            onSuspend={() => setStatus.mutate({ userId: selected.id, accountStatus: "SUSPENDED" })}
            onActivate={() => setStatus.mutate({ userId: selected.id, accountStatus: "ACTIVE" })}
            onResetPassword={() => setResetOpen(true)}
          />
        ) : undefined}
      />
      <FormSection number={1} title="Buat akun baru" description="Pemegang Saham dapat membuat Controller; Controller dapat membuat Admin dan Staf.">
        <CreateUserForm isShareholder={user?.role === "SHAREHOLDER"} initialRole={initialRole} isPending={create.isPending} onSubmit={(values) => create.mutate(values)} />
      </FormSection>
      {selected ? <ResetPasswordDialog accountName={accountDisplayName(selected)} open={resetOpen} onOpenChange={setResetOpen} isPending={resetPassword.isPending} onConfirm={(newPassword) => resetPassword.mutate({ userId: selected.id, newPassword })} /> : null}
    </div>
  );
}
