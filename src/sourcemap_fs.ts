import * as fs from 'fs/promises';
import { explore } from 'source-map-explorer';
import type { Ui, File } from './ui';

const ignoredPaths = ['[sourceMappingURL]', '[unmapped]', '[EOLs]'];

export async function sourcemapFs(path: string, ui: Ui) {
  const sourcemapFiles = (await fs.readdir(path)).filter((x) => x.endsWith('.map'));
  await Promise.all(
    sourcemapFiles.map(async (sourcemapFile) => {
      const explored = await explore(sourcemapFile);
      const files = explored.bundles.flatMap((bundle) => {
        const files: File[] = Object.entries(bundle.files)
          .filter(([path]) => ignoredPaths.includes(path))
          .map(([path, info]) => ({
            path,
            chunk: bundle.bundleName,
            bytes: info.size,
          }));
        return files;
      });
      ui.addFiles(...files);
    }),
  );

  for (const sourcemapFile of sourcemapFiles) {
    explore(sourcemapFile);
  }
}
