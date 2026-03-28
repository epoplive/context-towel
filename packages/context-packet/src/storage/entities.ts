/**
 * MikroORM entities for packet storage.
 *
 * These entities define the Postgres (or any MikroORM-supported DB) schema
 * for the packet system. Used by MikroOrmPacketDatabase.
 */

import { Entity, PrimaryKey, Property, Index, Unique } from '@mikro-orm/core'

@Entity({ tableName: 'packet_meta' })
export class PacketMetaEntity {
  @PrimaryKey({ type: 'text' })
  name!: string

  @Property({ type: 'bigint' })
  createdAt!: number

  @Property({ type: 'bigint' })
  updatedAt!: number

  @Property({ type: 'boolean', default: false })
  active!: boolean

  @Property({ type: 'text', nullable: true })
  planFileRef?: string

  @Property({ type: 'json', default: '[]' })
  tags!: string[]
}

@Entity({ tableName: 'packet_versions' })
@Index({ properties: ['packetName', 'timestamp'] })
export class PacketVersionEntity {
  @PrimaryKey({ type: 'text' })
  id!: string

  @Property({ type: 'text' })
  packetName!: string

  @Property({ type: 'bigint' })
  timestamp!: number

  @Property({ type: 'text' })
  triggerType!: string

  @Property({ type: 'text' })
  content!: string

  @Property({ type: 'text', nullable: true })
  deltaFromPrev?: string
}

@Entity({ tableName: 'packet_deltas' })
@Index({ properties: ['packetName', 'timestamp'] })
@Index({ properties: ['packetName', 'nodeId'] })
export class PacketDeltaEntity {
  @PrimaryKey({ type: 'text' })
  id!: string

  @Property({ type: 'text' })
  packetName!: string

  @Property({ type: 'bigint' })
  timestamp!: number

  @Property({ type: 'text', nullable: true })
  nodeId?: string

  @Property({ type: 'text' })
  type!: string

  @Property({ type: 'text' })
  content!: string
}

@Entity({ tableName: 'packet_keyframes' })
@Index({ properties: ['packetName', 'triggerNodeId'] })
export class PacketKeyframeEntity {
  @PrimaryKey({ type: 'text' })
  id!: string

  @Property({ type: 'text' })
  packetName!: string

  @Property({ type: 'bigint' })
  timestamp!: number

  @Property({ type: 'text' })
  triggerNodeId!: string

  @Property({ type: 'text' })
  content!: string
}

@Entity({ tableName: 'packet_edges' })
@Index({ properties: ['packetName'] })
@Index({ properties: ['packetName', 'sourceNode'] })
@Index({ properties: ['packetName', 'targetNode'] })
export class PacketEdgeEntity {
  @PrimaryKey({ type: 'text' })
  id!: string

  @Property({ type: 'text' })
  packetName!: string

  @Property({ type: 'text' })
  sourceNode!: string

  @Property({ type: 'text' })
  targetNode!: string

  @Property({ type: 'bigint' })
  createdAt!: number
}

@Entity({ tableName: 'packet_patterns' })
@Index({ properties: ['subsystem'] })
export class PacketPatternEntity {
  @PrimaryKey({ type: 'text' })
  id!: string

  @Property({ type: 'text' })
  subsystem!: string

  @Property({ type: 'text', nullable: true })
  codebase?: string

  @Property({ type: 'text' })
  content!: string

  @Property({ type: 'text' })
  sourcePacket!: string

  @Property({ type: 'bigint' })
  createdAt!: number

  @Property({ type: 'bigint' })
  updatedAt!: number

  @Property({ type: 'float', default: 1.0 })
  confidence!: number
}

@Entity({ tableName: 'packet_docs' })
@Index({ properties: ['packetName'] })
@Unique({ properties: ['packetName', 'docPath'] })
export class PacketDocEntity {
  @PrimaryKey({ autoincrement: true })
  id!: number

  @Property({ type: 'text' })
  packetName!: string

  @Property({ type: 'text' })
  docPath!: string

  @Property({ type: 'text' })
  content!: string

  @Property({ type: 'bigint' })
  createdAt!: number

  @Property({ type: 'bigint' })
  updatedAt!: number
}

/** All packet entities for MikroORM discovery */
export const packetEntities = [
  PacketMetaEntity,
  PacketVersionEntity,
  PacketDeltaEntity,
  PacketKeyframeEntity,
  PacketEdgeEntity,
  PacketPatternEntity,
  PacketDocEntity,
]
