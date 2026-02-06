import { DocumentGraph, type DocumentGraphProps } from '../components/DocumentGraph'

export type ContextGraphViewProps = DocumentGraphProps

export function ContextGraphView(props: ContextGraphViewProps) {
  return <DocumentGraph {...props} />
}
