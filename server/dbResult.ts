/** Jumlah baris yang berubah dari hasil `update`/`delete` drizzle-mysql2 (`[ResultSetHeader, …]`). */
export const affectedRows = (result: unknown) => Number((result as [{ affectedRows?: number }] | undefined)?.[0]?.affectedRows ?? 0);
