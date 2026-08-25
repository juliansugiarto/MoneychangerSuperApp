import { UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { StaffRole } from "../../drizzle/schema";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;

const roleRank: Record<StaffRole, number> = {
  STAFF: 1,
  ADMIN: 2,
  CONTROLLER: 3,
  SHAREHOLDER: 4,
};

const requireUser = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const requirePasswordUpdate = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  if (ctx.user.mustChangePassword) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Anda wajib mengganti kata sandi awal sebelum menggunakan fitur operasional." });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

function requireMinimumRole(minimumRole: StaffRole) {
  return t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    if (roleRank[ctx.user.role] < roleRank[minimumRole]) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Peran Anda tidak memiliki kewenangan untuk tindakan ini." });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  });
}

export const protectedProcedure = t.procedure.use(requireUser);
export const operationalProcedure = protectedProcedure.use(requirePasswordUpdate);
export const staffProcedure = operationalProcedure.use(requireMinimumRole("STAFF"));
export const adminProcedure = operationalProcedure.use(requireMinimumRole("ADMIN"));
export const controllerProcedure = operationalProcedure.use(requireMinimumRole("CONTROLLER"));
export const shareholderProcedure = operationalProcedure.use(requireMinimumRole("SHAREHOLDER"));
export const governanceProcedure = operationalProcedure.use(requireMinimumRole("CONTROLLER"));

export function hasMinimumRole(role: StaffRole, minimumRole: StaffRole) {
  return roleRank[role] >= roleRank[minimumRole];
}
