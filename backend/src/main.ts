import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync } from 'fs';
import { json } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors();
  app.setGlobalPrefix('api');
  app.use(json({ limit: '10mb' }));

  // 静态图片
  app.useStaticAssets(join(__dirname, '..', 'public', 'images'), {
    prefix: '/images/',
  });

  // 托管前端构建产物（生产环境）
  const frontendDist = join(__dirname, '..', '..', 'frontend', 'dist');
  if (existsSync(frontendDist)) {
    app.useStaticAssets(frontendDist);
    // SPA history fallback：非 /api 路由返回 index.html
    const express = app.getHttpAdapter().getInstance();
    express.get('*', (req: any, res: any) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/images')) {
        return res.status(404).json({ message: 'Not found' });
      }
      res.sendFile(join(frontendDist, 'index.html'));
    });
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
