import { useCallback, useState } from 'react'

/**
 * Runs an async operation while exposing consistent loading/error state.
 * The caller remains responsible for deciding when to invoke execute().
 */
export function useAsync<TArgs extends unknown[], TResult>(
  operation: (...args: TArgs) => Promise<TResult>,
) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const execute = useCallback(async (...args: TArgs) => {
    setLoading(true)
    setError(null)
    try {
      return await operation(...args)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'An unexpected error occurred.'
      setError(message)
      throw cause
    } finally {
      setLoading(false)
    }
  }, [operation])

  return { execute, loading, error, setError }
}
