import { AsyncLocalStorage } from "node:async_hooks";
import type { Request, Response, NextFunction } from "express";
import { clientIp } from "./clientIp";

/**
 * 요청 단위 컨텍스트 — "지금 이 요청을 누가 보냈나"를 요청 처리 전 구간에서 읽는다.
 *
 * 감사 로그(`logAction`)는 호출부가 214곳이고 그중 절반은 `actorId` 를 넘기지 않아
 * `system_log` 의 "누가"가 비어 있었다. 호출부를 전부 고치는 대신 인증 미들웨어가
 * 여기에 행위자를 한 번 심고, `logAction` 이 인자가 없을 때 이 값을 쓴다. 그러면
 * 앞으로 새로 생기는 호출부도 자동으로 채워진다 — 사람이 매번 기억해야 하는
 * 규칙은 결국 지켜지지 않는다.
 *
 * `AsyncLocalStorage` 는 await 경계를 넘어 유지되므로 비동기 핸들러 안쪽에서도
 * 같은 값을 본다. 요청 밖(크론·스크립트)에서 부르면 store 가 없어 `null` 이고,
 * 그 경우 로그는 종전대로 `actor_type = "System"` 으로 남는다.
 */

export type ActorType = "User" | "Partner" | "Guest" | "ApiClient" | "System";

export interface RequestActor {
  /** admin_users.id — 관리자일 때만 채운다. 파트너·게스트 id 는 다른 테이블이라 섞지 않는다. */
  id: number | null;
  email: string | null;
  role: string | null;
  type: ActorType;
}

interface Store {
  actor: RequestActor | null;
  /** 요청 IP. 감사 로그 호출부 대부분이 이것도 넘기지 않는다. */
  ip: string | null;
}

const storage = new AsyncLocalStorage<Store>();

/** 모든 요청을 컨텍스트 안에서 처리한다. 라우터·인증보다 앞에 mount 할 것. */
export function requestContext(req: Request, _res: Response, next: NextFunction): void {
  storage.run({ actor: null, ip: clientIp(req) || null }, () => next());
}

/** 인증 미들웨어가 토큰을 검증한 직후 호출한다. */
export function setRequestActor(actor: RequestActor): void {
  const store = storage.getStore();
  if (store) store.actor = actor;
}

export function getRequestActor(): RequestActor | null {
  return storage.getStore()?.actor ?? null;
}

export function getRequestIp(): string | null {
  return storage.getStore()?.ip ?? null;
}

/**
 * 요청 컨텍스트를 끌고 들어가지 못하는 자리(크론, 백그라운드 작업)에서 명시적으로
 * 행위자를 세울 때 쓴다.
 */
export function runWithActor<T>(actor: RequestActor | null, fn: () => T): T {
  return storage.run({ actor, ip: null }, fn);
}
