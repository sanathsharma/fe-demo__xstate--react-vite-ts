import log from "loglevel";
import {
  assign,
  type DoneActorEvent,
  type ErrorActorEvent,
  not,
  setup,
  type PromiseActorLogic,
  type ActorRefFromLogic,
  type AnyActorLogic,
  assertEvent,
} from "xstate";

type PartialOptions = {
  retryEnabled?: boolean;
  retryCount?: number;
  retryDelay?: number;
};

type Options<TData, TPayload, TError> = PartialOptions & {
  promise: PromiseActorLogic<TData, TPayload, MachineEvents<TData, TError, TPayload>>;
};
type Meta<TPayload = unknown> = { retryAttempts: number; payload?: TPayload; options: Required<PartialOptions> };

type MachineContext<TData, TError = Error, TPayload = unknown> = {
  response?: TData;
  error?: TError;
  _meta: Meta<TPayload>;
  childRef?: ActorRefFromLogic<AnyActorLogic>;
};

export type MachineEvents<TData, TError = Error, TPayload = unknown> =
  | { type: "FETCH"; payload: TPayload }
  | { type: "FETCH_BG"; payload?: Partial<TPayload> | ((payload: TPayload) => TPayload) }
  | { type: "UPDATE"; update: (prev: TData) => TData }
  | { type: "REJECT" }
  | { type: "RESOLVE" }
  | DoneActorEvent<TData, "promise">
  | ErrorActorEvent<TError, "promise">;

export const createFetchMachine = <TData, TError = Error, TPayload = unknown>(
  id: string,
  options: Options<TData, TPayload, TError>
) => {
  type Events = MachineEvents<TData, TError, TPayload>;
  type Context = MachineContext<TData, TError, TPayload>;

  const { promise, ...partialOptions } = options;

  const initialOptions: Required<PartialOptions> = Object.assign(
    {},
    { retryCount: 3, retryEnabled: false, retryDelay: 1000 },
    partialOptions
  );

  const initialMeta: Meta<TPayload> = { retryAttempts: 0, payload: undefined, options: initialOptions };

  const pendingMachine = setup({
    types: {
      context: {} as Context,
      input: {} as TPayload,
      output: {} as Pick<Context, "response" | "error">,
    },
    actions: {
      updateRetryAttepmts: ({ context }) => {
        return {
          ...context,
          _meta: { ...context._meta, retryAttempts: context._meta.retryAttempts + 1 },
        };
      },
    },
    actors: {
      promise,
    },
    delays: {
      retryDelay: ({ context }) => {
        return context._meta.options.retryDelay;
      },
    },
    guards: {
      canAttemptRetry: ({ context }) => {
        const { retryEnabled, retryCount } = context._meta.options;
        if (!retryEnabled) {
          return false;
        }
        return context._meta.retryAttempts < retryCount;
      },
    },
  }).createMachine({
    id: "pendingMachine",
    initial: "default",
    context: ({ input }) => ({ response: undefined, error: undefined, _meta: { ...initialMeta, payload: input } }),
    output: ({ context }) => {
      return { response: context.response, error: context.error };
    },
    states: {
      default: {
        invoke: {
          id: "promise",
          src: "promise",
          input: ({ context }) => {
            return context._meta.payload;
          },
          onDone: {
            target: "done",
            actions: [
              assign({
                response: ({ event }) => {
                  // assertEvent(event, "xstate.done.actor.promise");
                  return event.output as TData;
                },
                error: undefined,
              }),
            ],
          },
          onError: [
            {
              target: "done",
              guard: not("canAttemptRetry"),
              actions: [
                assign({
                  response: undefined,
                  error: ({ event }) => {
                    // assertEvent(event, "xstate.error.actor.promise");
                    return event.error as TError;
                  },
                }),
              ],
            },
            {
              guard: "canAttemptRetry",
              target: "retry",
            },
          ],
        },
      },
      retry: {
        description: "Intermediate state to acheive delay in retry attemps",
        after: {
          retryDelay: {
            target: "default",
            actions: ["updateRetryAttepmts"],
          },
        },
      },
      done: {
        type: "final",
      },
    },
  });

  return setup({
    types: {
      context: {} as Context,
      events: {} as Events,
    },
    actions: {
      onSuccess: (_, data: TData) => log.debug("success", data),
      onError: (_, error) => log.debug("error", error),
      updateData: assign(({ context, event }) => {
        return {
          ...context,
          response: event.output.response,
          error: event.output.error,
        };
      }),
    },
  }).createMachine({
    id: id,
    initial: "idle",
    context: { response: undefined, error: undefined, _meta: initialMeta },
    states: {
      idle: {
        on: {
          FETCH: {
            target: "pending",
            actions: assign({
              _meta: ({ event, context }) => {
                return { ...context._meta, payload: event.payload };
              },
            }),
          },
        },
      },
      pending: {
        invoke: {
          id: "pendingMachine",
          src: pendingMachine,
          input: ({ event }) => {
            assertEvent(event, "FETCH");
            return event.payload;
          },
          onDone: [
            {
              guard: ({ event }) => !!event.output.error,
              target: "rejected",
              actions: ["updateData"],
            },
            {
              target: "resolved",
              guard: ({ event }) => !event.output.error,
              actions: ["updateData"],
            },
          ],
        },
      },
      refetching: {
        invoke: {
          id: "pendingMachine",
          src: pendingMachine,
          input: ({ event, context }) => {
            assertEvent(event, "FETCH_BG");
            const _payload = typeof event.payload === "function" ? event.payload(context._meta.payload) : event.payload;
            return Object.assign({}, context._meta.payload, _payload);
          },
          onDone: [
            {
              guard: ({ event }) => !!event.output.error,
              target: "rejected",
              actions: ["updateData"],
            },
            {
              target: "resolved",
              guard: ({ event }) => !event.output.error,
              actions: ["updateData"],
            },
          ],
        },
      },
      resolved: {
        entry: [
          {
            type: "onSuccess",
            params: ({ context }) => context.response as TData,
          },
        ],
        on: {
          FETCH: "pending",
          UPDATE: {
            actions: assign({
              response: ({ event, context }) => {
                log.info({ event, context });
                return event.update(context.response as TData);
              },
            }),
          },
          FETCH_BG: "refetching",
        },
      },
      rejected: {
        entry: [
          {
            type: "onError",
            params: ({ context }) => context.error,
          },
        ],
        description: "After all the retry attemps (if enabled), if still error persists, this state is entered.",
        on: {
          FETCH: "pending",
        },
      },
    },
  });
};
