export type OutboxEvent<T = any> = {
  type: string;
  payload: T;
};
export type RunOnce = (fn:()=> Promise<void>) => Promise<void>

export type EventHandler<T=any> = (
  event: OutboxEvent<T>,
  ctx: RunOnce
) => Promise<void>;
