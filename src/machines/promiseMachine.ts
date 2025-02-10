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
  promise: PromiseActorLogic<TData, { payload: TPayload }, MachineEvents<TData, TError, TPayload>>;
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
  | DoneActorEvent<TData, "promise">
  | DoneActorEvent<{ response: TData; error: null } | { response: null; error: TError }, "pendingMachine">
  | ErrorActorEvent<TError, "promise">;

export const createPromiseMachine = <TData, TError = Error, TPayload = unknown>(
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
      input: {} as { payload: TPayload },
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
    context: ({ input }) => ({
      response: undefined,
      error: undefined,
      _meta: { ...initialMeta, payload: input.payload },
    }),
    output: ({ context }) => {
      return { response: context.response, error: context.error };
    },
    states: {
      default: {
        invoke: {
          id: "promise",
          src: "promise",
          input: ({ context }) => {
            return { payload: context._meta.payload as TPayload };
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
    actors: { pendingMachine },
    actions: {
      onSuccess: (_, params: { data: TData; payload: TPayload }) => log.debug("success", params),
      onError: (_, params: { error: TError; payload: TPayload }) => log.debug("error", params),
      updateData: assign({
        response: ({ event }) => {
          assertEvent(event, "xstate.done.actor.pendingMachine");
          return event.output.response as TData;
        },
        error: ({ event }) => {
          assertEvent(event, "xstate.done.actor.pendingMachine");
          return event.output.error as TError;
        },
      }),
    },
    guards: {
      isError: ({ event }) => {
        assertEvent(event, "xstate.done.actor.pendingMachine");
        return !!event.output.error;
      },
    },
  }).createMachine({
    /** @xstate-layout N4IgpgJg5mDOIC5QAoC2BDAxgCwJYDswBKAOlwgBswBiAMQFEAVAYQAkBtABgF1FQAHAPaxcAF1yD8fEAA9EATgDMikgCZ5ANgAcAdgCsAGhABPRABYAjCq1mNivZY1PnigL6ujaLHkKl+YfAgCKGoISTAyfAA3QQBrCP9A4IBZbwIwLl4kECERcUlpOQQLDRKSCz0NVUMTREUNThI9erM9LWUOxVUNd08MHHS-AKD8ELDCSJj4kkSRqFSBwnYLLIFhMQkpbKKlFXVtfSNTBFUdRsUlVXUS5yc3DxAvReISACcwADMwUUWx8Mm4glhik0kseNJchsCttzJw9CQzDZFIdaggtBYmr1Hv0fC93l8fj4-hMCFMgUlRgtcctVjl1vktqAimY4QikSjjl0VGdFBZqlinrjSO9YIIKFFIHQmGxMhD6ZtCgplGpNLoapy7CRFLZ7I5bnYBTjBm84GKJRBqABVAAKABEAIKMeiy7KQhmKhA6HSqEhaVTo6pHRBXFRmHQaSr8h6C40is2ShgsVgAfQAQgBxF1rPIKmEIPRKJpBk46PacXlRvqgvFgABWYEwogT0o44Nd8uhTMQFi0nB0JFLZmR6rqFka5Y0rXanS6PSx+EEEDg0hjvjlOc7sm7jVayP9FjO8j0bRsxYAtBoSJxr5xSsPqspWobq6RyFR11DGVu0beVQcRwgQ79n21z6i4z7PEMFJQB+7p5nyVQkBoOg9hydRmD6Nh2A4Ny3PcVaQSaBK-LBuZdvmWgIs03rooex5aKeqI9peuicLo049pwFhmGYEFCiaoripApGbkUg6+gWw7Fl0ZgIvsap8bGdYNk2EAiV+RQWPIqjnGhJylE0LRtDOs7uO4QA */
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
          src: "pendingMachine",
          input: ({ event }) => {
            assertEvent(event, "FETCH");
            return { payload: event.payload };
          },
          onDone: [
            {
              guard: "isError",
              target: "rejected",
              actions: ["updateData"],
            },
            {
              target: "resolved",
              guard: not("isError"),
              actions: ["updateData"],
            },
          ],
        },
      },
      refetching: {
        invoke: {
          id: "pendingMachine",
          src: "pendingMachine",
          input: ({ event, context }) => {
            assertEvent(event, "FETCH_BG");
            const _payload =
              typeof event.payload === "function" ? event.payload(context._meta.payload as TPayload) : event.payload;
            return { payload: Object.assign({}, context._meta.payload, _payload) };
          },
          onDone: [
            {
              guard: "isError",
              target: "rejected",
              actions: ["updateData"],
            },
            {
              target: "resolved",
              guard: not("isError"),
              actions: ["updateData"],
            },
          ],
        },
      },
      resolved: {
        entry: [
          {
            type: "onSuccess",
            params: ({ context }) => ({ data: context.response as TData, payload: context._meta.payload as TPayload }),
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
            params: ({ context }) => ({ error: context.error as TError, payload: context._meta.payload as TPayload }),
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
