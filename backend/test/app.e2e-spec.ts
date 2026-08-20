import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  it('/api/pokemon (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/pokemon?pageSize=2')
      .expect(200)
      .expect((res) => {
        if (res.body.total !== 1025) throw new Error('total should be 1025');
        if (res.body.items.length !== 2)
          throw new Error('should return 2 items');
      });
  });
});
