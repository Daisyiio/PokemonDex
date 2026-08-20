import { existsSync } from 'fs';
import { join } from 'path';

export function resolveDatasetPath(): string {
  const candidates = [
    process.env.DATASET_PATH,
    join(__dirname, '..', '..', '..', 'pokemon-dataset-zh-main'),
    join(__dirname, '..', '..', 'pokemon-dataset-zh-main'),
  ].filter((p): p is string => !!p);
  return (
    candidates.find((p) => existsSync(join(p, 'data', 'images'))) ||
    candidates[0]
  );
}
