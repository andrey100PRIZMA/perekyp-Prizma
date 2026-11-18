/**
 * Заглушка Supabase для UI-тестов: без сети, детерминированные ответы.
 * Подменяется через alias в ui-check.mjs — в продакшене не используется.
 */

const noop = () => {};

const emptyResult = {data: null, error: null};

const builder: any = new Proxy(
  {},
  {
    get: (_t, prop) => {
      if (prop === 'then') return undefined; // не тогдабельный — иначе await зависнет
      if (prop === 'single' || prop === 'maybeSingle') return () => Promise.resolve(emptyResult);
      return (..._args: unknown[]) => builder;
    },
  },
);

export const SUPABASE_URL = 'https://stub.test';
export const SUPABASE_PUBLISHABLE_KEY = 'stub';

export const supabase = {
  auth: {
    getSession: () => Promise.resolve({data: {session: null}, error: null}),
    getUser: () => Promise.resolve({data: {user: null}, error: null}),
    onAuthStateChange: () => ({data: {subscription: {unsubscribe: noop}}}),
    signInWithPassword: () => Promise.resolve({data: {user: null}, error: {message: 'stub'}}),
    signUp: () => Promise.resolve({data: {session: null}, error: null}),
    signOut: () => Promise.resolve({error: null}),
  },
  from: () => builder,
};
