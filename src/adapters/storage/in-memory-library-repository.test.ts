import { InMemoryLibraryRepository } from './in-memory-library-repository'
import { libraryRepositoryContract } from './library-repository-contract'

libraryRepositoryContract(() => new InMemoryLibraryRepository())
