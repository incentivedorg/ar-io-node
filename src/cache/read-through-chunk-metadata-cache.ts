import winston from 'winston';

import {
  ChunkByAnySource,
  ChunkMetadata,
  ChunkMetadataByAnySource,
  ChunkMetadataStore,
} from '../types.js';

export class ReadThroughChunkMetadataCache implements ChunkMetadataByAnySource {
  private log: winston.Logger;
  private chunkSource: ChunkByAnySource;
  private chunkMetadataStore: ChunkMetadataStore;

  constructor({
    log,
    chunkSource,
    chunkMetadataStore,
  }: {
    log: winston.Logger;
    chunkSource: ChunkByAnySource;
    chunkMetadataStore: ChunkMetadataStore;
  }) {
    this.log = log.child({ class: this.constructor.name });
    this.chunkSource = chunkSource;
    this.chunkMetadataStore = chunkMetadataStore;
  }

  async getChunkMetadataByAny(
    txSize: number,
    absoluteOffset: number,
    dataRoot: string,
    relativeOffset: number,
  ): Promise<ChunkMetadata> {
    const chunkMetadataPromise = this.chunkMetadataStore
      .get(dataRoot, relativeOffset)
      .then(async (cachedChunkMetadata) => {
        // Chunk metadata is cached
        if (cachedChunkMetadata) {
          this.log.info('Successfully fetched chunk data from cache', {
            dataRoot,
            relativeOffset,
          });
          return cachedChunkMetadata;
        }

        // Fetch from ChunkSource
        const chunk = await this.chunkSource.getChunkByAny(
          txSize,
          absoluteOffset,
          dataRoot,
          relativeOffset,
        );

        // TODO use an assertion to compare the data root passed in with the
        // extracted value

        const chunkMetadata = {
          data_root: chunk.tx_path.slice(-64, -32),
          data_size: chunk.chunk.length,
          offset: relativeOffset,
          data_path: chunk.data_path,
          hash: chunk.data_path.slice(-64, -32),
        };

        await this.chunkMetadataStore.set(chunkMetadata);

        return chunkMetadata;
      });

    return chunkMetadataPromise;
  }
}