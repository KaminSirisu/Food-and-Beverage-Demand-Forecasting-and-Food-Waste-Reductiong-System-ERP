// Password hashing with Node's built-in scrypt — no native bcrypt/argon2 builds.
// Stored format: "<salt hex>:<hash hex>". Never store or log the plain password.
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number, opts: ScryptOptions) => Promise<Buffer>;

// N = 2^15 costs ~32 MB and ~50-100 ms per hash: slow for an attacker, fine for one login.
const PARAMS: ScryptOptions = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LEN = 64;

export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const hash = await scrypt(password.normalize("NFKC"), salt, KEY_LEN, PARAMS);
    return `${salt.toString("hex")}: ${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
    const [ saltHex, hashHex ] = stored.split(":");
    if (!saltHex || !hashHex ) return false;
    const expected = Buffer.from(hashHex, "hex");
    const actual = await scrypt(password.normalize("NFKC"), Buffer.from(saltHex, "hex"), expected.length, PARAMS);
    return timingSafeEqual(actual, expected); // constant time: no leak via "how many bytes matched"
}

// Used when the email is unknown, so "no such user" takes as long as "wrong password".
let dummy: Promise<string> | undefined;
export function dummyHash(): Promise<string> {
    return (dummy ??= hashPassword(randomBytes(16).toString("hex")));
}