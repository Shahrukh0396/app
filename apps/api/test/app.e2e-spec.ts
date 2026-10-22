import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { execSync } from 'child_process';
import request from 'supertest';
import { AppModule } from '../src/app.module';

const databaseUrl = process.env.DATABASE_URL;
const e2eEnabled = Boolean(databaseUrl) && process.env.SCANFLOW_E2E === '1';
const suite = e2eEnabled ? describe : describe.skip;

suite('auth and documents (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    execSync('pnpm exec prisma migrate deploy', {
      cwd: __dirname + '/..',
      stdio: 'inherit',
      env: process.env,
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers, logs in, and performs document CRUD', async () => {
    const email = `e2e-${Date.now()}@scanflow.app`;
    const deviceId = 'device-e2e-123456';
    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'E2E', email, password: 'correct-horse', deviceId })
      .expect(201);
    expect(registered.body.accessToken).toEqual(expect.any(String));

    const loggedIn = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'correct-horse', deviceId })
      .expect(201);
    const token = loggedIn.body.accessToken as string;

    const created = await request(app.getHttpServer())
      .post('/documents')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Lease', description: 'Unit 4', tags: ['legal'] })
      .expect(201);
    const id = created.body.id as string;

    const fetched = await request(app.getHttpServer())
      .get(`/documents/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(fetched.body.title).toBe('Lease');

    await request(app.getHttpServer())
      .put(`/documents/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Lease signed', version: fetched.body.version })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/documents/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const bin = await request(app.getHttpServer())
      .get('/documents?deleted=true')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(bin.body.some((row: { id: string }) => row.id === id)).toBe(true);

    await request(app.getHttpServer())
      .post(`/documents/${id}/restore`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
  });
});
