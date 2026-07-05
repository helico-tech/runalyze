import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { DexieLibraryRepository } from './dexie-library-repository'
import { libraryRepositoryContract } from './library-repository-contract'

let counter = 0
libraryRepositoryContract(
  () =>
    new DexieLibraryRepository({
      name: `test-db-${++counter}`,
      indexedDB: new IDBFactory(),
      IDBKeyRange,
    }),
)
