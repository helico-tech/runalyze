import { useCallback, useEffect, useState } from 'react'
import type { Activity, TestResult } from '../domain/model/types'
import { useContainer } from './container-context'

export function useActivities() {
  const { repo } = useContainer()
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const refresh = useCallback(() => {
    void repo.listActivities().then((list) => {
      setActivities(list)
      setLoading(false)
    })
  }, [repo])
  useEffect(refresh, [refresh])
  return { activities, loading, refresh }
}

export function useTestResults() {
  const { repo } = useContainer()
  const [results, setResults] = useState<TestResult[]>([])
  const refresh = useCallback(() => {
    void repo.listTestResults().then(setResults)
  }, [repo])
  useEffect(refresh, [refresh])
  return { results, refresh }
}
