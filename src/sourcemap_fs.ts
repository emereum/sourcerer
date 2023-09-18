import * as fs from 'fs/promises';
import * as path from 'path';
import type { Ui } from './ui';
import { SourceMapConsumer } from 'source-map';

export interface FilteredDataset {
  modules: Module[];
  chunks: Chunk[];
  symbols: string[];
  loaded: boolean;
  subscribeProgress?: (handler: (pct: number) => void) => void;
}

export interface Module {
  path: string;
  rawPath: string;
  chunks: Chunk[];
  symbols: string;
  mappings?: Mapping[];
}

export interface Mapping {
  generatedLine: number;
  generatedColumn: number;
  originalLine: number;
  originalColumn: number;
  name: string;
}

export interface Chunk {
  path: string;
  modules: Module[];
  symbols: string[];
  areSymbolsParsedOrParsing: boolean;
}

export function sourcemapFs(sourcemapsPath: string) {
  const subscribers: ((pct: number) => void)[] = [];
  const dataset: FilteredDataset = {
    modules: [],
    chunks: [],
    symbols: [],
    loaded: false,
    subscribeProgress: (handler: (pct: number) => void) => {
      subscribers.push(handler);
    },
  };

  loadSourcemapsIntoDataset(sourcemapsPath, dataset, subscribers);
  return dataset;
}

async function loadSourcemapsIntoDataset(
  sourcemapsPath: string,
  dataset: FilteredDataset,
  subscribers: ((pct: number) => void)[],
) {
  const sourcemapFiles = (await fs.readdir(sourcemapsPath))
    .filter((x) => x.endsWith('.map'))
    .map((x) => path.join(sourcemapsPath, x))
    .sort();

  let loadedChunks = 0;
  for (const sourcemapFile of sourcemapFiles) {
    const sourcemap: { sources: string[]; sourcesContent?: string[]; file?: string } = JSON.parse(
      await fs.readFile(sourcemapFile, { encoding: 'utf-8' }),
    );

    const chunk: Chunk = {
      path: sourcemapFile,
      modules: [],
      symbols: [],
      areSymbolsParsedOrParsing: false,
    };

    if (sourcemap.sourcesContent != null && sourcemap.sources.length !== sourcemap.sourcesContent.length) {
      throw new Error('Number of sources and sourcesContent did not matching in ' + sourcemapFile);
    }

    const sourcesAndSymbols = sourcemap.sources.map((source, i) => ({ source, symbols: sourcemap.sourcesContent?.[i] ?? '' }));

    const modules: Module[] = sourcesAndSymbols
      .filter(({ source }) => !source.endsWith('.css'))
      .map(({ source, symbols }) => ({
        path: source.indexOf('webpack:///') === 0 ? source.substring(11) : source,
        rawPath: source,
        chunks: [chunk],
        symbols,
      }));
    chunk.modules.push(...modules);
    chunk.symbols.push(...modules.map(x => x.symbols));

    dataset.chunks.push(chunk);
    dataset.modules.push(...modules);
    dataset.symbols.push(...modules.map(x => x.symbols));

    for (const subscriber of subscribers) {
      subscriber(++loadedChunks / sourcemapFiles.length);
    }
  }

  dataset.chunks.sort((a, b) => a.path.localeCompare(b.path));
  dataset.modules.sort((a, b) => a.path.localeCompare(b.path));
  dataset.loaded = true;
}

/**
 * Given a dataset, open all the sourcemaps for the chunks and parse them.
 * Store the resulting mappings(i.e. original line/col to generated line/col)
 * in the dataset.
 *
 * This takes a few seconds for a large codebase so is better to run it only once
 * some initial filtering has been done to pare down the number of sourcemaps we parse.
 */
export async function loadSourceMappings(dataset: FilteredDataset) {
  for (const chunk of dataset.chunks) {
    if (chunk.areSymbolsParsedOrParsing) {
      continue;
    }

    const modulesByPath = new Map(chunk.modules.map((module) => [module.rawPath, module]));

    const sourcemap = await fs.readFile(chunk.path, { encoding: 'utf-8' });
    await SourceMapConsumer.with(sourcemap, null, (consumer) => {
      consumer.eachMapping((mapping) => {
        if (mapping.source == null || mapping.source.endsWith('.css')) {
          return;
        }

        const module = modulesByPath.get(mapping.source);
        if (module == null && mapping.source.includes('/node_modules/')) {
          return;
        }

        if (module == null) {
          //throw new Error('missing module when parsing source tokens: ' + JSON.stringify(mapping));
          return;
        }

        (module.mappings ??= []).push({
          ...mapping,
          // make line numbers 0-based again since source-map makes them 1-based
          // https://github.com/mozilla/source-map/pull/277
          originalLine: mapping.originalLine - 1,
          generatedLine: mapping.generatedLine - 1,
        });
      });
    });
  }
}
