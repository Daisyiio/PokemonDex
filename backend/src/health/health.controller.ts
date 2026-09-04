import { Controller, ForbiddenException, Get, Headers, Post } from '@nestjs/common';
import { dataVersion, resetAllCaches, cacheRegistryNames } from '../cache-guard';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return {
      ok: true,
      dataVersion: dataVersion(),
      caches: cacheRegistryNames(),
      cacheRefreshEnabled: !!process.env.CACHE_ADMIN_TOKEN,
    };
  }

  @Post('admin/cache-refresh')
  refreshCaches(@Headers('x-admin-token') token?: string) {
    const required = process.env.CACHE_ADMIN_TOKEN;
    if (!required) {
      throw new ForbiddenException('未启用缓存刷新（设置 CACHE_ADMIN_TOKEN 后可用）');
    }
    if (token !== required) {
      throw new ForbiddenException('token 无效');
    }
    resetAllCaches();
    return { ok: true, dataVersion: dataVersion(), caches: cacheRegistryNames() };
  }
}
