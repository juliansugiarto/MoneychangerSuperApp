import mysql from "mysql2/promise";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL tidak tersedia.");

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [[transactions]] = await connection.query(`
    SELECT
      COUNT(*) AS historicalTransactionCount,
      COUNT(DISTINCT historicalSourceKey) AS distinctSourceKeyCount,
      SUM(isHistorical = false) AS nonHistoricalTransactionCount
    FROM exchange_transactions
    WHERE historicalSourceKey LIKE 'HIST-TXN:%'
  `);
  const [[rates]] = await connection.query(`
    SELECT COUNT(*) AS historicalRateCount, SUM(status = 'ACTIVE') AS activeHistoricalRateCount
    FROM operational_rates
    WHERE isHistorical = true
  `);
  const [[customers]] = await connection.query(`
    SELECT COUNT(*) AS historicalCustomerCount, SUM(profileStatus = 'ACTIVE') AS activeHistoricalCustomerCount
    FROM customers
    WHERE isHistorical = true
  `);
  const [[cashImpact]] = await connection.query(`
    SELECT COUNT(*) AS historicalCashMovementCount
    FROM cash_balance_movements AS movement
    INNER JOIN exchange_transactions AS transaction ON transaction.id = movement.transactionId
    WHERE transaction.isHistorical = true
  `);
  const [[audit]] = await connection.query(`
    SELECT COUNT(*) AS importAuditCount
    FROM audit_logs
    WHERE action = 'HISTORICAL_LEDGER_IMPORTED'
  `);
  console.log(JSON.stringify({ transactions, rates, customers, cashImpact, audit }, null, 2));
} finally {
  connection.destroy();
}
