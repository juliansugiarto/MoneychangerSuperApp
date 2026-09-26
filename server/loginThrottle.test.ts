import { describe, expect, it } from "vitest";
import { THROTTLE_MAX_LOCK_MS, createThrottle, throttleKeys } from "./loginThrottle";

function clock(start = 1_000_000) {
  let now = start;
  return { now: () => now, advance: (ms: number) => { now += ms; } };
}

const KEYS = ["t:login:user:budi", "t:login:ip:10.0.0.1"];

describe("pembatas percobaan masuk", () => {
  it("empat kegagalan belum mengunci", () => {
    const time = clock();
    const throttle = createThrottle(time.now);
    for (let i = 0; i < 4; i += 1) throttle.recordFailure(KEYS);
    expect(throttle.check(KEYS)).toEqual({ allowed: true });
  });

  it("kegagalan kelima mengunci 30 detik, lalu terbuka lagi", () => {
    const time = clock();
    const throttle = createThrottle(time.now);
    for (let i = 0; i < 5; i += 1) throttle.recordFailure(KEYS);
    expect(throttle.check(KEYS)).toEqual({ allowed: false, retryAfterSeconds: 30 });
    time.advance(30_000);
    expect(throttle.check(KEYS)).toEqual({ allowed: true });
  });

  it("penguncian berikutnya berlipat dua", () => {
    const time = clock();
    const throttle = createThrottle(time.now);
    for (let i = 0; i < 5; i += 1) throttle.recordFailure(KEYS);
    time.advance(31_000);
    for (let i = 0; i < 5; i += 1) throttle.recordFailure(KEYS);
    expect(throttle.check(KEYS)).toEqual({ allowed: false, retryAfterSeconds: 60 });
  });

  it("jedanya tidak pernah melebihi 15 menit", () => {
    const time = clock();
    const throttle = createThrottle(time.now);
    for (let lock = 0; lock < 8; lock += 1) {
      for (let i = 0; i < 5; i += 1) throttle.recordFailure(KEYS);
      time.advance(THROTTLE_MAX_LOCK_MS + 1);
    }
    for (let i = 0; i < 5; i += 1) throttle.recordFailure(KEYS);
    expect(throttle.check(KEYS)).toEqual({ allowed: false, retryAfterSeconds: 900 });
  });

  it("kegagalan yang lebih tua dari 15 menit tidak dihitung", () => {
    const time = clock();
    const throttle = createThrottle(time.now);
    for (let i = 0; i < 4; i += 1) throttle.recordFailure(KEYS);
    time.advance(16 * 60_000);
    throttle.recordFailure(KEYS);
    expect(throttle.check(KEYS)).toEqual({ allowed: true });
  });

  it("berhasil masuk menghapus hitungan username, bukan hitungan IP", () => {
    const time = clock();
    const throttle = createThrottle(time.now);
    for (let i = 0; i < 4; i += 1) throttle.recordFailure(KEYS);
    throttle.recordSuccess(KEYS[0]);
    throttle.recordFailure(KEYS);
    expect(throttle.check([KEYS[0]])).toEqual({ allowed: true });
    expect(throttle.check(KEYS)).toEqual({ allowed: false, retryAfterSeconds: 30 });
  });

  it("kunci dipisah per tenant dan cakupan, username tanpa beda huruf besar", () => {
    expect(throttleKeys("login", "abcvalas", " Budi ", "10.0.0.1")).toEqual({ user: "abcvalas:login:user:budi", ip: "abcvalas:login:ip:10.0.0.1" });
    expect(throttleKeys("recover", null, "budi", "10.0.0.1").user).toBe("default:recover:user:budi");
  });
});
