import React from 'react'
import type { WidgetSpec, WidgetType } from '../core-widgets/types'

export type WidgetRenderer = (node: WidgetSpec, children: React.ReactNode[]) => React.ReactNode

export type WidgetRegistry = Map<WidgetType, WidgetRenderer>

export const createWidgetRegistry = (): WidgetRegistry => new Map()

const defaultRegistry: WidgetRegistry = createWidgetRegistry()

defaultRegistry.set('text', (node, children) => <span>{node.text ?? children}</span>)
defaultRegistry.set('card', (node, children) => (
  <div className="widget-card">
    {node.props?.title && <div className="widget-card__title">{node.props.title}</div>}
    <div className="widget-card__body">{children}</div>
  </div>
))
defaultRegistry.set('grid', (node, children) => {
  const columns = typeof node.props?.columns === 'number' ? node.props.columns : 2
  return (
    <div className="widget-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 8 }}>
      {children}
    </div>
  )
})
defaultRegistry.set('list', (_node, children) => <ul className="widget-list">{children}</ul>)
defaultRegistry.set('item', (_node, children) => <li className="widget-list__item">{children}</li>)
defaultRegistry.set('table', (_node, children) => <table className="widget-table"><tbody>{children}</tbody></table>)
defaultRegistry.set('row', (_node, children) => <tr>{children}</tr>)
defaultRegistry.set('column', (_node, children) => <td>{children}</td>)
defaultRegistry.set('form', (_node, children) => <form className="widget-form">{children}</form>)
defaultRegistry.set('field', (node, children) => (
  <div className="widget-field">
    {node.props?.label && <label className="widget-field__label">{node.props.label}</label>}
    <div className="widget-field__body">{children}</div>
  </div>
))

const renderNode = (node: WidgetSpec, registry: WidgetRegistry, key?: string): React.ReactNode => {
  const renderer = registry.get(node.type)
  const children = node.children?.map((child, index) => renderNode(child, registry, `${node.type}-${index}`)) ?? []
  if (renderer) {
    return <React.Fragment key={key}>{renderer(node, children)}</React.Fragment>
  }
  if (node.type === 'text') {
    return <React.Fragment key={key}>{node.text ?? null}</React.Fragment>
  }
  return <div key={key}>{children}</div>
}

export const renderWidgetTree = (
  nodes: WidgetSpec[],
  registry: WidgetRegistry = defaultRegistry
): React.ReactNode[] => nodes.map((node, index) => renderNode(node, registry, `${node.type}-${index}`))

export const widgetRegistry = defaultRegistry
