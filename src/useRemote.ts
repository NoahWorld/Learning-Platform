import { useEffect, useState, type DependencyList } from "react";

interface RemoteState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useRemote<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  dependencies: DependencyList,
): RemoteState<T> {
  const [state, setState] = useState<RemoteState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({ ...previous, loading: true, error: null }));

    loader(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({ data, loading: false, error: null });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            data: null,
            loading: false,
            error: error instanceof Error ? error.message : "加载失败",
          });
        }
      });

    return () => controller.abort();
    // The caller owns dependency stability, like React's built-in effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return state;
}
