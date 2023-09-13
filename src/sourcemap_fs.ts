import * as fs from 'fs/promises';
import * as path from 'path';
import type { Ui } from './ui';

export async function sourcemapFs(sourcemapsPath: string, ui: Ui) {
  const sourcemapFiles = (await fs.readdir(sourcemapsPath))
    .filter((x) => x.endsWith('.map'))
    .map((x) => path.join(sourcemapsPath, x));

  await Promise.all(
    sourcemapFiles.map(async (sourcemapFile) => {
      const sourcemap: { sources: string[]; file?: string } = JSON.parse(
        await fs.readFile(sourcemapFile, { encoding: 'utf-8' }),
      );

      const files = sourcemap.sources
        .filter((x) => !x.endsWith('.css'))
        .map((source) => ({
          path: source.indexOf('webpack:///') === 0 ? source.substring(11) : source,
          chunk: sourcemapFile,
          bytes: -1,
        }));

      ui.addFiles(...files);
    }),
  );
}
