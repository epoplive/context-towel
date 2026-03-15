// ============================================================================
// Subscription types + notification helpers for FileParserService
// ============================================================================
//
// Copied from LG's file-parser-core/subscriptions.ts.

import type { ParseAllSubscriber, ParseSubscriber, ParsedFileData } from './types'
import { matchesPathPattern } from './path'

export interface Subscription {
  parserId: string
  pathPattern: string | RegExp
  callback: ParseSubscriber
}

export interface AllSubscription {
  pathPattern: string | RegExp
  callback: ParseAllSubscriber
}

export function notifySubscribers(args: {
  filePath: string
  data: ParsedFileData
  subscriptions: Map<number, Subscription>
  allSubscriptions: Map<number, AllSubscription>
  getCachedData: <T = unknown>(parserId: string, pathPattern?: string | RegExp) => Map<string, T[]>
}): void {
  const { filePath, data, subscriptions, allSubscriptions, getCachedData } = args

  // Notify per-parser subscriptions
  for (const [, sub] of subscriptions) {
    if (!matchesPathPattern(filePath, sub.pathPattern)) continue

    const parserResult = data.results.get(sub.parserId)
    if (parserResult) {
      const allData = getCachedData(sub.parserId, sub.pathPattern)
      sub.callback(parserResult.items, filePath, allData)
    }
  }

  // Notify "all parsers" subscriptions with full ParsedFileData
  for (const [, sub] of allSubscriptions) {
    if (!matchesPathPattern(filePath, sub.pathPattern)) continue

    try {
      sub.callback(filePath, data)
    } catch (e) {
      console.error('[FileParserService] subscribeAll callback error:', e)
    }
  }
}

export function notifySubscriber(args: {
  subscriptionId: number
  subscriptions: Map<number, Subscription>
  getCachedData: <T = unknown>(parserId: string, pathPattern?: string | RegExp) => Map<string, T[]>
}): void {
  const { subscriptionId, subscriptions, getCachedData } = args
  const sub = subscriptions.get(subscriptionId)
  if (!sub) return

  const allData = getCachedData(sub.parserId, sub.pathPattern)

  // Call once with first matching file (initial data seeding)
  for (const [path, items] of allData) {
    sub.callback(items, path, allData)
    return
  }
}

export function notifySubscribersForRemoval(args: {
  filePath: string
  subscriptions: Map<number, Subscription>
  allSubscriptions: Map<number, AllSubscription>
  getCachedData: <T = unknown>(parserId: string, pathPattern?: string | RegExp) => Map<string, T[]>
}): void {
  const { filePath, subscriptions, allSubscriptions, getCachedData } = args

  // Notify per-parser subscriptions with empty items for the removed file
  for (const [, sub] of subscriptions) {
    if (!matchesPathPattern(filePath, sub.pathPattern)) continue

    const allData = getCachedData(sub.parserId, sub.pathPattern)
    sub.callback([], filePath, allData)
  }

  // Notify "all parsers" subscriptions with empty data for removed file
  const emptyData: ParsedFileData = {
    path: filePath,
    content: '',
    lastModified: Date.now(),
    results: new Map(),
  }
  for (const [, sub] of allSubscriptions) {
    if (!matchesPathPattern(filePath, sub.pathPattern)) continue

    try {
      sub.callback(filePath, emptyData)
    } catch (e) {
      console.error('[FileParserService] subscribeAll callback error:', e)
    }
  }
}
