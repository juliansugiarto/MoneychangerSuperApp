export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  // Legacy: only read by the unused OAuth upsert path in db.ts. Safe to leave unset.
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  initialShareholderUsername: process.env.INITIAL_SHAREHOLDER_USERNAME ?? "",
  initialShareholderPassword: process.env.INITIAL_SHAREHOLDER_PASSWORD ?? "",
  isProduction: process.env.NODE_ENV === "production",
  // Cloudflare R2 (S3-compatible object storage) for KYC/operational documents.
  r2AccountId: process.env.R2_ACCOUNT_ID ?? "",
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  r2BucketName: process.env.R2_BUCKET_NAME ?? "",
  // Shared secret checked by /api/scheduled/bi-rate-sync so an external cron
  // (crontab, systemd timer, GitHub Actions, etc.) can trigger the sync safely.
  cronSecret: process.env.CRON_SECRET ?? "",
};
