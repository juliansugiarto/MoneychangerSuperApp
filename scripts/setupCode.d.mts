import type { Connection } from "mysql2/promise";
export const SETUP_CODE_ALPHABET: string;
export function generateSetupCode(): string;
export function hashSetupCode(code: string): Promise<string>;
export function writeSetupCode(connection: Connection): Promise<string>;
