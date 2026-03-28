import { beforeAll, beforeEach, describe } from 'vitest'
import { MikroORM } from '@mikro-orm/sqlite'
import { MikroOrmPacketDatabase } from '../../../src/storage/MikroOrmPacketDatabase'
import { packetEntities } from '../../../src/storage/entities'
import { runStorageConformanceTests } from './in-memory.spec'

describe('MikroOrmPacketDatabase (SQLite)', () => {
  let orm: MikroORM

  beforeAll(async () => {
    orm = await MikroORM.init({
      entities: packetEntities,
      dbName: ':memory:',
      allowGlobalContext: true,
    })
  })

  // Recreate schema before each test for clean state
  beforeEach(async () => {
    const generator = orm.getSchemaGenerator()
    await generator.refreshDatabase()
  })

  runStorageConformanceTests(() => {
    return new MikroOrmPacketDatabase(orm.em)
  })
})
