import React, { createContext, useContext, useEffect, useState } from 'react';

/* ------------------------------------------------------------------ */
/* labels / i18n                                                       */
/* ------------------------------------------------------------------ */

export interface StateLabels {
  loading: string;
  emptyTitle: string;
  emptyDescription?: string;
  errorTitle: string;
  errorDescription?: string;
  retry: string;
  offline: string;
}

export const labelsEn: StateLabels = {
  loading: 'Loading…',
  emptyTitle: 'Nothing here yet',
  emptyDescription: 'There is no data to show.',
  errorTitle: 'Something went wrong',
  errorDescription: 'Please try again.',
  retry: 'Try again',
  offline: 'You are offline. Check your connection.',
};

export const labelsUz: StateLabels = {
  loading: 'Yuklanmoqda…',
  emptyTitle: "Hozircha ma'lumot yo'q",
  emptyDescription: "Ko'rsatish uchun ma'lumot topilmadi.",
  errorTitle: 'Xatolik yuz berdi',
  errorDescription: "Iltimos, qayta urinib ko'ring.",
  retry: 'Qayta urinish',
  offline: "Internet aloqasi yo'q. Ulanishni tekshiring.",
};

export const labelsRu: StateLabels = {
  loading: 'Загрузка…',
  emptyTitle: 'Пока ничего нет',
  emptyDescription: 'Нет данных для отображения.',
  errorTitle: 'Что-то пошло не так',
  errorDescription: 'Пожалуйста, попробуйте ещё раз.',
  retry: 'Повторить',
  offline: 'Нет подключения к интернету.',
};

interface Config {
  labels: StateLabels;
  /** Show the loading view only after this many ms (avoids flicker on fast loads). */
  loadingDelay: number;
  unstyled: boolean;
}

const ConfigContext = createContext<Config>({ labels: labelsEn, loadingDelay: 200, unstyled: false });

export interface StateViewsProviderProps {
  children?: React.ReactNode;
  /** Built-in `'en' | 'uz' | 'ru'`, or your own labels (merged with English). */
  labels?: 'en' | 'uz' | 'ru' | Partial<StateLabels>;
  /** @default 200 */
  loadingDelay?: number;
  /** Render without built-in styles (use your own CSS via class names). @default false */
  unstyled?: boolean;
}

/** Set language, loading delay and styling for all state views below. */
export function StateViewsProvider({ children, labels = 'en', loadingDelay = 200, unstyled = false }: StateViewsProviderProps) {
  const resolved =
    labels === 'uz' ? labelsUz : labels === 'ru' ? labelsRu : labels === 'en' ? labelsEn : { ...labelsEn, ...labels };
  return <ConfigContext.Provider value={{ labels: resolved, loadingDelay, unstyled }}>{children}</ConfigContext.Provider>;
}

const useConfig = () => useContext(ConfigContext);

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.setAttribute('data-react-state-views', '');
  style.textContent = `
.sv-state{--sv-fg:#1f2937;--sv-muted:#6b7280;--sv-accent:#2563eb;--sv-danger:#dc2626;--sv-skeleton:#e5e7eb;--sv-skeleton-shine:#f3f4f6;
display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:32px 16px;text-align:center;color:var(--sv-fg,#1f2937);font:14px/1.5 system-ui,sans-serif}
.sv-state__icon{color:var(--sv-muted,#6b7280);margin-bottom:4px}
.sv-state--error .sv-state__icon{color:var(--sv-danger,#dc2626)}
.sv-state__title{font-weight:600;font-size:15px;margin:0}
.sv-state__description{color:var(--sv-muted,#6b7280);margin:0;max-width:420px}
.sv-state__action{margin-top:8px}
.sv-button{font:inherit;padding:6px 14px;border-radius:6px;border:1px solid var(--sv-accent,#2563eb);background:var(--sv-accent,#2563eb);color:#fff;cursor:pointer}
.sv-button:hover{filter:brightness(1.1)}
.sv-button:focus-visible{outline:3px solid color-mix(in srgb,var(--sv-accent,#2563eb) 40%,transparent);outline-offset:2px}
.sv-spinner{width:28px;height:28px;border-radius:50%;border:3px solid var(--sv-skeleton,#e5e7eb);border-top-color:var(--sv-accent,#2563eb);animation:sv-spin .8s linear infinite}
.sv-skeleton{display:block;border-radius:6px;background:linear-gradient(90deg,var(--sv-skeleton,#e5e7eb) 25%,var(--sv-skeleton-shine,#f3f4f6) 37%,var(--sv-skeleton,#e5e7eb) 63%);background-size:400% 100%;animation:sv-shine 1.4s ease infinite}
@keyframes sv-spin{to{transform:rotate(360deg)}}
@keyframes sv-shine{0%{background-position:100% 50%}100%{background-position:0 50%}}
@media (prefers-reduced-motion:reduce){.sv-spinner,.sv-skeleton{animation:none}}
[data-theme=dark] .sv-state,.sv-state[data-theme=dark]{--sv-fg:#e5e7eb;--sv-muted:#9ca3af;--sv-skeleton:#374151;--sv-skeleton-shine:#4b5563;--sv-accent:#3b82f6}
`;
  document.head.appendChild(style);
}

function useStyles() {
  const { unstyled } = useConfig();
  if (!unstyled) injectStyles();
  return unstyled;
}

/* ------------------------------------------------------------------ */
/* icons                                                               */
/* ------------------------------------------------------------------ */

const EmptyIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d="M3 13l2.5-7.5A2 2 0 0 1 7.4 4h9.2a2 2 0 0 1 1.9 1.5L21 13" />
    <path d="M3 13v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5h-5l-1.5 2h-5L8 13H3z" />
  </svg>
);

const ErrorIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
  </svg>
);

/* ------------------------------------------------------------------ */
/* building blocks                                                     */
/* ------------------------------------------------------------------ */

interface BaseProps {
  className?: string;
  style?: React.CSSProperties;
}

export interface LoadingStateProps extends BaseProps {
  /** Text under the spinner (also announced to screen readers). */
  label?: React.ReactNode;
  /** Replace the spinner (e.g. with skeletons). */
  children?: React.ReactNode;
}

/** Spinner with an accessible label. */
export function LoadingState({ label, children, className, style }: LoadingStateProps) {
  const unstyled = useStyles();
  const { labels } = useConfig();
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={[unstyled ? '' : 'sv-state sv-state--loading', className].filter(Boolean).join(' ')} style={style}>
      {children ?? <span className={unstyled ? undefined : 'sv-spinner'} aria-hidden="true" />}
      <span className={unstyled ? undefined : 'sv-state__description'}>{label ?? labels.loading}</span>
    </div>
  );
}

export interface EmptyStateProps extends BaseProps {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Call to action, e.g. `<button>Create first project</button>`. */
  action?: React.ReactNode;
}

/** "Nothing here" view with optional call to action. */
export function EmptyState({ icon, title, description, action, className, style }: EmptyStateProps) {
  const unstyled = useStyles();
  const { labels } = useConfig();
  const c = (name: string) => (unstyled ? undefined : name);
  return (
    <div role="status" className={[c('sv-state sv-state--empty'), className].filter(Boolean).join(' ')} style={style}>
      <div className={c('sv-state__icon')}>{icon ?? <EmptyIcon />}</div>
      <p className={c('sv-state__title')}>{title ?? labels.emptyTitle}</p>
      {(description ?? labels.emptyDescription) && <p className={c('sv-state__description')}>{description ?? labels.emptyDescription}</p>}
      {action && <div className={c('sv-state__action')}>{action}</div>}
    </div>
  );
}

/** Best-effort human message from any error shape (Error, fetch/axios errors, strings, `{ message }`). */
export function getErrorMessage(error: unknown): string | undefined {
  if (!error) return undefined;
  if (typeof error === 'string') return error;
  const e = error as { message?: unknown; data?: { message?: unknown }; response?: { data?: { message?: unknown } } };
  const nested = e.response?.data?.message ?? e.data?.message;
  if (typeof nested === 'string') return nested;
  if (typeof e.message === 'string') return e.message;
  return undefined;
}

export interface ErrorStateProps extends BaseProps {
  error?: unknown;
  title?: React.ReactNode;
  /** Defaults to the error message. */
  description?: React.ReactNode;
  icon?: React.ReactNode;
  /** Shows a retry button. */
  onRetry?: () => void;
  retryLabel?: React.ReactNode;
  /** Show the raw error message. @default true */
  showMessage?: boolean;
}

/** Error view with message and retry; announces itself (`role="alert"`). */
export function ErrorState({ error, title, description, icon, onRetry, retryLabel, showMessage = true, className, style }: ErrorStateProps) {
  const unstyled = useStyles();
  const { labels } = useConfig();
  const c = (name: string) => (unstyled ? undefined : name);
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const message = description ?? (offline ? labels.offline : (showMessage && getErrorMessage(error)) || labels.errorDescription);
  return (
    <div role="alert" className={[c('sv-state sv-state--error'), className].filter(Boolean).join(' ')} style={style}>
      <div className={c('sv-state__icon')}>{icon ?? <ErrorIcon />}</div>
      <p className={c('sv-state__title')}>{title ?? labels.errorTitle}</p>
      {message && <p className={c('sv-state__description')}>{message}</p>}
      {onRetry && (
        <div className={c('sv-state__action')}>
          <button type="button" className={c('sv-button')} onClick={onRetry}>
            {retryLabel ?? labels.retry}
          </button>
        </div>
      )}
    </div>
  );
}

export interface SkeletonProps extends BaseProps {
  /** Number of text lines. @default 1 */
  lines?: number;
  width?: number | string;
  /** Height of one line. @default 14 */
  height?: number | string;
  /** Round avatar skeleton. */
  circle?: boolean;
  gap?: number;
}

/** Shimmering placeholder (respects `prefers-reduced-motion`). */
export function Skeleton({ lines = 1, width = '100%', height = 14, circle, gap = 8, className, style }: SkeletonProps) {
  useStyles();
  if (circle) {
    const size = typeof height === 'number' && height !== 14 ? height : 40;
    return <span aria-hidden="true" className={['sv-skeleton', className].filter(Boolean).join(' ')} style={{ width: size, height: size, borderRadius: '50%', ...style }} />;
  }
  return (
    <span aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap, width: '100%', ...style }}>
      {Array.from({ length: lines }, (_, i) => (
        <span
          key={i}
          className={['sv-skeleton', className].filter(Boolean).join(' ')}
          // last line shorter, like real paragraphs
          style={{ width: lines > 1 && i === lines - 1 ? '60%' : width, height }}
        />
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* AsyncView                                                           */
/* ------------------------------------------------------------------ */

/** Shape of React Query / SWR / Apollo results (all optional). */
export interface QueryLike<T> {
  data?: T;
  error?: unknown;
  isLoading?: boolean;
  isPending?: boolean;
  isFetching?: boolean;
  isValidating?: boolean;
  loading?: boolean;
  refetch?: () => unknown;
  mutate?: () => unknown;
}

/** Default emptiness check: null/undefined, `[]`, `''`, `{}`, `Map`/`Set` of size 0. */
export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (value instanceof Map || value instanceof Set) return value.size === 0;
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) return Object.keys(value).length === 0;
  return false;
}

export interface AsyncViewProps<T> {
  /** React Query / SWR / Apollo result — or use `loading`, `error`, `data`. */
  query?: QueryLike<T>;
  loading?: boolean;
  error?: unknown;
  data?: T;
  /** Custom emptiness check. @default isEmptyValue */
  isEmpty?: (data: T) => boolean;
  /** Retry handler (defaults to `query.refetch` / `query.mutate`). */
  onRetry?: () => void;
  /** Rendered when data is ready. */
  children: (data: NonNullable<T>) => React.ReactNode;
  /** Custom views. */
  loadingView?: React.ReactNode;
  emptyView?: React.ReactNode;
  errorView?: (error: unknown, retry?: () => void) => React.ReactNode;
  /** Props for the default empty state (title, description, action…). */
  empty?: EmptyStateProps;
  /** Keep showing old data while refetching or after a refetch error. @default true */
  keepPreviousData?: boolean;
  /** Override the provider's loading delay, ms. */
  loadingDelay?: number;
}

function useDelayed(active: boolean, delay: number): boolean {
  const [show, setShow] = useState(active && delay <= 0);
  useEffect(() => {
    if (!active) {
      setShow(false);
      return undefined;
    }
    if (delay <= 0) {
      setShow(true);
      return undefined;
    }
    const id = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(id);
  }, [active, delay]);
  return show;
}

/**
 * Renders loading → error → empty → content, in that order, from any async state.
 *
 * @example
 * const query = useQuery({ queryKey: ['projects'], queryFn: fetchProjects });
 * <AsyncView query={query} empty={{ title: 'No projects', action: <button>New project</button> }}>
 *   {(projects) => <ProjectList items={projects} />}
 * </AsyncView>
 *
 * @example
 * <AsyncView loading={loading} error={error} data={users} onRetry={reload}>
 *   {(users) => users.map((u) => <UserRow key={u.id} user={u} />)}
 * </AsyncView>
 */
export function AsyncView<T>(props: AsyncViewProps<T>) {
  const { query, isEmpty = isEmptyValue, children, loadingView, emptyView, errorView, empty, keepPreviousData = true } = props;
  const config = useConfig();
  const data = (props.data ?? query?.data) as T | undefined;
  const error = props.error ?? query?.error;
  const loading = props.loading ?? query?.isLoading ?? query?.isPending ?? query?.loading ?? false;
  const retry = props.onRetry ?? (query?.refetch ? () => void query.refetch!() : query?.mutate ? () => void query.mutate!() : undefined);
  const hasData = data !== undefined && data !== null;

  const showLoading = useDelayed(loading && !(keepPreviousData && hasData), props.loadingDelay ?? config.loadingDelay);

  if (error && !(keepPreviousData && hasData)) {
    return <>{errorView ? errorView(error, retry) : <ErrorState error={error} onRetry={retry} />}</>;
  }
  if (loading && !(keepPreviousData && hasData)) {
    // render nothing during the delay to avoid a flash of spinner on fast loads
    return showLoading ? <>{loadingView ?? <LoadingState />}</> : null;
  }
  if (!hasData || isEmpty(data as T)) {
    return <>{emptyView ?? <EmptyState {...empty} />}</>;
  }
  return <>{children(data as NonNullable<T>)}</>;
}
