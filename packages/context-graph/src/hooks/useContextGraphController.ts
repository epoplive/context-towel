import { useMemo } from 'react'
import { createContextGraphController, type ContextGraphController } from '../controller/ContextGraphController'

export const useContextGraphController = (): ContextGraphController => {
  return useMemo(() => createContextGraphController(), [])
}
