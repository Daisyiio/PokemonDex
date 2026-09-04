// 统一静态缓存生命周期：所有 service 的静态缓存注册到这里。
// 数据重导（重新导入 dev.db）后，调用 resetAllCaches() 即可整体失效，
// 或修改环境变量 DATA_VERSION 并在部署时重启进程。

const resetters = new Map<string, () => void>();

export function registerCacheResetter(name: string, fn: () => void): void {
  resetters.set(name, fn);
}

export function resetAllCaches(): void {
  for (const fn of resetters.values()) fn();
}

export function cacheRegistryNames(): string[] {
  return [...resetters.keys()];
}

export function dataVersion(): string {
  return process.env.DATA_VERSION || 'default';
}
