import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import * as policy from '../lib/student-media.ts';
import * as avatars from '../lib/profile-avatars.ts';
import * as signatures from '../lib/workspace-logo-upload.ts';
import { copyStudentPhoto, retireStudentPhoto } from '../lib/student-photo-migration.ts';

const nativeRequire = createRequire(import.meta.url);
function moduleAt(path, mocks, globals = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  const require = name => {
    if (name in mocks) return mocks[name];
    if (name.startsWith('node:')) return nativeRequire(name);
    throw Error(`Unexpected real dependency: ${name}`);
  };
  new Function('require', 'exports', 'fetch', 'process', js)(require, exports, globals.fetch ?? (() => { throw Error('No network in tests'); }), globals.process ?? { env: {} });
  return exports;
}
const stored = (id, workspaceId, selfService = false) => ({ id, workspaceId, data: { accountType: selfService ? 'SELF_SERVICE' : 'COACHED', profileImageUrl: `https://store.private.blob.vercel-storage.com/student-profile/${id}/photo.jpg` } });
const students = { a: stored('a', 'wa'), b: stored('b', 'wa'), c: stored('c', 'wb'), solo: stored('solo', 'personal', true) };
function routeHarness({ studentId = 'a', trainerWorkspace = null, missing = false, rankingIds = ['a', 'b'], mustChangePassword = false } = {}) {
  const student = students[studentId];
  const reads = [];
  const session = student ? { studentId, credential: { student: { ...student, serviceType: 'CLASSES' }, mustChangePassword } } : null;
  const route = moduleAt('app/api/portal/media/[kind]/[id]/route.ts', {
    '@/lib/prisma': { prisma: {
      workspace: { findUnique: async () => ({ status: 'ACTIVE' }) },
      studentRecord: { findUnique: async ({ where }) => students[where.id] ?? null },
      quickLogPhoto: { findUnique: async ({ where }) => where.id === 'photo-b' ? { id: 'photo-b', blobUrl: 'https://store.private.blob.vercel-storage.com/quick-logs/b/log-b/photo.jpg', quickLogId: 'log-b', quickLog: { id: 'log-b', studentId: 'b' } } : null },
    } },
    '@/lib/portal-auth': { getPortalSession: async () => session },
    '@/lib/admin-api-auth': { requireAdminApiResponse: async () => trainerWorkspace ? null : new Response(null, { status: 401 }) },
    '@/lib/trainer-workspace': { requireTrainerWorkspace: async () => ({ workspaceId: trainerWorkspace }) },
    '@/lib/self-service': { isSelfService: data => data.accountType === 'SELF_SERVICE' },
    '@/lib/point-ranking': { loadPointRanking: async () => rankingIds.map(studentId => ({ studentId })) },
    '@/lib/student-service': { isCompetitiveGamificationEligible: type => type === 'CLASSES' },
    '@/lib/student-media': policy,
    '@/lib/student-media-storage': { readStudentPhoto: async (...args) => { reads.push(args); return missing ? null : { bytes: new Uint8Array([255, 216, 255]), contentType: 'image/jpeg' }; } },
  });
  return { reads, request: (kind, id, method = 'GET') => route[method](new Request(`https://example.test/api/portal/media/${kind}/${id}`, { method }), { params: Promise.resolve({ kind, id }) }) };
}

test('student reads own profile through authenticated route; no Blob URL response', async () => {
  const h = routeHarness(); const res = await h.request('profile', 'a');
  assert.equal(res.status, 200); assert.equal(res.headers.get('content-type'), 'image/jpeg');
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
  assert.equal(res.headers.get('vary'), 'Cookie'); assert.equal(res.headers.get('location'), null);
  assert.equal(h.reads[0][1], 'a');
});
test('trainer can read profiles in own workspace', async () => {
  assert.equal((await routeHarness({ studentId: null, trainerWorkspace: 'wa' }).request('profile', 'b')).status, 200);
});
test('trainer cannot read another workspace', async () => {
  const h = routeHarness({ studentId: null, trainerWorkspace: 'wa' });
  assert.equal((await h.request('profile', 'c')).status, 404); assert.equal(h.reads.length, 0);
});
test('student A cannot read B direct profile, even in same workspace', async () => {
  const h = routeHarness(); assert.equal((await h.request('profile', 'b')).status, 404); assert.equal(h.reads.length, 0);
});
test('progress: only owner and authorized trainer, never peer or cross-workspace', async () => {
  for (const [options, status] of [[{ studentId: 'a' }, 404], [{ studentId: 'b' }, 200], [{ studentId: 'c' }, 404], [{ studentId: null, trainerWorkspace: 'wa' }, 200], [{ studentId: null, trainerWorkspace: 'wb' }, 404]]) {
    const h = routeHarness(options); assert.equal((await h.request('progress', 'photo-b')).status, status);
    if (status === 404) assert.equal(h.reads.length, 0);
  }
});
test('ranking permits only a currently visible profile in same workspace', async () => {
  assert.equal((await routeHarness().request('ranking', 'b')).status, 200);
  assert.equal((await routeHarness({ rankingIds: ['a'] }).request('ranking', 'b')).status, 404);
  assert.equal((await routeHarness().request('ranking', 'c')).status, 404);
});
test('ranking never accepts a progress image ID', async () => {
  const h = routeHarness(); assert.equal((await h.request('ranking', 'photo-b')).status, 404); assert.equal(h.reads.length, 0);
  assert.equal(policy.studentProfilePhoto('b', 'https://store.private.blob.vercel-storage.com/quick-logs/b/log-b/photo.jpg', true), '');
});
test('SELF_SERVICE only own image, no ranking or trainer access', async () => {
  const h = routeHarness({ studentId: 'solo' });
  assert.equal((await h.request('profile', 'solo')).status, 200);
  assert.equal((await h.request('profile', 'a')).status, 404);
  assert.equal((await h.request('ranking', 'solo')).status, 404);
  assert.equal((await routeHarness({ studentId: null, trainerWorkspace: 'personal' }).request('profile', 'solo')).status, 404);
});
test('missing blob uses safe fallback after authorization', async () => {
  const response = await routeHarness({ missing: true }).request('profile', 'a');
  assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'image/svg+xml');
  assert.match(await response.text(), /Imagen no disponible/);
});
test('invalid session and temporary-password session cannot read', async () => {
  for (const options of [{ studentId: null }, { mustChangePassword: true }]) {
    const h = routeHarness(options); assert.equal((await h.request('profile', 'a')).status, 404); assert.equal(h.reads.length, 0);
  }
});
test('HEAD enforces same isolation and returns no body', async () => {
  const h = routeHarness();
  assert.equal((await h.request('profile', 'b', 'HEAD')).status, 404);
  const response = await h.request('profile', 'a', 'HEAD'); assert.equal(response.status, 200); assert.equal(await response.text(), '');
});
test('invalid identifiers and unknown resource kinds never read storage', async () => {
  const h = routeHarness();
  assert.equal((await h.request('profile', '../a')).status, 404);
  assert.equal((await h.request('other', 'a')).status, 404); assert.equal(h.reads.length, 0);
});
test('serialized URLs hide public/private sources, change on replacement, keep bundled avatars', () => {
  const source = students.a.data.profileImageUrl;
  const path = policy.studentProfilePhoto('a', source);
  assert.match(path, /^\/api\/portal\/media\/profile\/a\?v=\d+$/);
  assert.notEqual(path, policy.studentProfilePhoto('a', source.replace('photo.jpg', 'new.jpg')));
  assert.equal(policy.studentProfilePhoto('b', source), '');
  assert.equal(policy.studentProfilePhoto('a', '/avatars/bm-shield-v3.webp'), '/avatars/bm-shield-v3.webp');
  assert.doesNotMatch(JSON.stringify(policy.publicStudent('a', students.a.data)), /blob\.vercel-storage/);
});
test('SSRF and wrong owner paths rejected; historical public sources accepted only by owner prefix', () => {
  for (const source of ['http://127.0.0.1/a.jpg', 'https://store.private.blob.vercel-storage.com.evil.test/student-profile/a/photo.jpg', students.b.data.profileImageUrl, students.a.data.profileImageUrl + '?token=x']) assert.equal(policy.ownedStudentBlob(source, 'a', 'profile'), null);
  assert.equal(policy.ownedStudentBlob(students.a.data.profileImageUrl.replace('.private.', '.public.'), 'a', 'profile').access, 'public');
});

function uploadHarness({ failUpload = false, persistCount = 1 } = {}) {
  const writes = [], removed = [];
  const route = moduleAt('app/api/portal/profile-photo/route.ts', {
    '@/lib/student-media': policy,
    '@/lib/profile-avatars': avatars,
    '@/lib/portal-auth': { validRequestOrigin: () => true, getPortalSession: async () => ({ studentId: 'a', credential: { student: { ...students.a, updatedAt: new Date(0) } } }) },
    '@/lib/prisma': { prisma: { workspace: { findUnique: async () => ({ status: 'ACTIVE' }) }, studentRecord: { updateMany: async args => { writes.push(args); return { count: persistCount }; } } } },
    '@/lib/student-media-storage': { studentPhotoToken: () => 'test-only', removeStudentPhoto: async (...args) => removed.push(args), uploadStudentPhoto: async () => { if (failUpload) throw Error('storage failed'); return { url: students.a.data.profileImageUrl.replace('photo.jpg', 'new.jpg') }; } },
  });
  async function upload() {
    const form = new FormData(); form.set('photo', new File([new Uint8Array([255, 216, 255])], 'photo.jpg', { type: 'image/jpeg' }));
    return route.POST(new Request('https://example.test/api/portal/profile-photo', { method: 'POST', body: form }));
  }
  return { writes, removed, upload };
}
test('profile upload persists private source but returns authenticated route only', async () => {
  const h = uploadHarness(); const response = await h.upload();
  assert.equal(response.status, 200); const body = await response.json(); assert.match(body.photoUrl, /^\/api\/portal\/media\/profile\/a/);
  assert.doesNotMatch(JSON.stringify(body), /blob\.vercel-storage/);
  assert.equal(h.writes[0].where.workspaceId, 'wa'); assert.ok(h.writes[0].where.updatedAt);
  assert.equal(h.removed[0][0], students.a.data.profileImageUrl);
});
test('failed upload preserves old reference and never removes it', async () => {
  const h = uploadHarness({ failUpload: true }); assert.equal((await h.upload()).status, 500);
  assert.equal(h.writes.length, 0); assert.equal(h.removed.length, 0);
});
test('concurrent update cleans new orphan only, not previous photo', async () => {
  const h = uploadHarness({ persistCount: 0 }); assert.equal((await h.upload()).status, 500);
  assert.equal(h.removed.length, 1); assert.match(h.removed[0][0], /new\.jpg$/);
});
test('storage upload explicitly requires private access and dedicated token', async () => {
  let options;
  const storage = moduleAt('lib/student-media-storage.ts', { 'server-only': {}, '@vercel/blob': { put: async (_path, _bytes, opts) => { options = opts; return { url: students.a.data.profileImageUrl }; } }, '@/lib/student-media': policy, '@/lib/workspace-logo-upload': signatures }, { process: { env: { STUDENT_PHOTOS_BLOB_READ_WRITE_TOKEN: 'test-only' } } });
  await storage.uploadStudentPhoto('student-profile/a/photo.jpg', new Uint8Array([255, 216, 255]), 'image/jpeg');
  assert.equal(options.access, 'private'); assert.equal(options.token, 'test-only');
});
test('historical reader streams authenticated bytes without following redirects or caching', async () => {
  let options;
  const storage = moduleAt('lib/student-media-storage.ts', { 'server-only': {}, '@vercel/blob': {}, '@/lib/student-media': policy, '@/lib/workspace-logo-upload': signatures }, { fetch: async (_url, opts) => { options = opts; return new Response(new Uint8Array([255, 216, 255]), { status: 200 }); } });
  const image = await storage.readStudentPhoto(students.a.data.profileImageUrl.replace('.private.', '.public.'), 'a', 'profile');
  assert.equal(image.contentType, 'image/jpeg'); assert.equal(options.redirect, 'error'); assert.equal(options.cache, 'no-store');
});
test('quick log serializer never exposes Blob URL or pathname', () => {
  const { quickLogJson } = moduleAt('lib/quick-logs.ts', { '@/lib/student-media': policy });
  const now = new Date();
  const result = quickLogJson({ id: 'log', date: now, createdAt: now, updatedAt: now, previousValue: null, currentValue: null, photos: [{ id: 'photo-b', blobUrl: 'secret', blobPathname: 'secret-path', createdAt: now }] });
  assert.equal(result.photos[0].blobUrl, '/api/portal/media/progress/photo-b');
  assert.doesNotMatch(JSON.stringify(result), /secret/);
});

test('migration verifies copy before CAS; public deletion is a separate explicit phase', async () => {
  const previousUrl = students.a.data.profileImageUrl.replace('.private.', '.public.');
  const bytes = new Uint8Array([255, 216, 255]);
  const events = [];
  const receipt = await copyStudentPhoto({ studentId: 'a', kind: 'profile', previousUrl }, {
    read: async url => { events.push(url === previousUrl ? 'read-public' : 'verify-private'); return bytes; },
    uploadPrivate: async () => { events.push('upload-private'); return students.a.data.profileImageUrl; },
    replaceIfUnchanged: async (old, next) => { assert.equal(old, previousUrl); assert.equal(next, students.a.data.profileImageUrl); events.push('cas'); return true; },
  });
  assert.deepEqual(events, ['read-public', 'upload-private', 'verify-private', 'cas']);
  await retireStudentPhoto(receipt, { read: async () => bytes, canRetire: async () => true, removePublic: async url => { assert.equal(url, previousUrl); events.push('retire'); } });
  assert.equal(events.at(-1), 'retire');
});
test('migration refuses corrupted copy before changing reference', async () => {
  const previousUrl = students.a.data.profileImageUrl.replace('.private.', '.public.');
  await assert.rejects(copyStudentPhoto({ studentId: 'a', kind: 'profile', previousUrl }, {
    read: async url => new Uint8Array(url === previousUrl ? [255, 216, 255] : [1, 2]),
    uploadPrivate: async () => students.a.data.profileImageUrl,
    replaceIfUnchanged: async () => { assert.fail('Must not persist bad copy'); },
  }), /MIGRATION_COPY_MISMATCH/);
});
test('migration stops on concurrent replacement without deleting original', async () => {
  await assert.rejects(copyStudentPhoto({ studentId: 'a', kind: 'profile', previousUrl: students.a.data.profileImageUrl.replace('.private.', '.public.') }, {
    read: async () => new Uint8Array([255, 216, 255]), uploadPrivate: async () => students.a.data.profileImageUrl, replaceIfUnchanged: async () => false,
  }), /MIGRATION_REFERENCE_CHANGED/);
});
test('retirement refuses references still in use and modified private copy', async () => {
  const bytes = new Uint8Array([255, 216, 255]);
  const receipt = await copyStudentPhoto({ studentId: 'a', kind: 'profile', previousUrl: students.a.data.profileImageUrl.replace('.private.', '.public.') }, {
    read: async () => bytes, uploadPrivate: async () => students.a.data.profileImageUrl, replaceIfUnchanged: async () => true,
  });
  await assert.rejects(retireStudentPhoto(receipt, { read: async () => bytes, canRetire: async () => false, removePublic: async () => assert.fail('Deletion not allowed') }), /RETIREMENT_NOT_AUTHORIZED/);
  await assert.rejects(retireStudentPhoto(receipt, { read: async () => new Uint8Array([1]), canRetire: async () => true, removePublic: async () => assert.fail('Deletion not allowed') }), /COPY_MISMATCH/);
});
test('private store read requires token, validates bytes and does not expose metadata', async () => {
  let options;
  const storage = moduleAt('lib/student-media-storage.ts', { 'server-only': {}, '@vercel/blob': { get: async (_url, opts) => { options = opts; return { stream: new Response(new Uint8Array([255, 216, 255])).body }; } }, '@/lib/student-media': policy, '@/lib/workspace-logo-upload': signatures }, { process: { env: { STUDENT_PHOTOS_BLOB_READ_WRITE_TOKEN: 'test-only' } } });
  const result = await storage.readStudentPhoto(students.a.data.profileImageUrl, 'a', 'profile');
  assert.equal(options.access, 'private'); assert.equal(result.contentType, 'image/jpeg');
  assert.equal('url' in result, false);
});
test('historical 404 returns missing, oversized or non-image content never served', async () => {
  const source = students.a.data.profileImageUrl.replace('.private.', '.public.');
  for (const response of [new Response(null, { status: 404 }), new Response('<script>bad</script>'), new Response(new Uint8Array(3 * 1024 * 1024 + 1))]) {
    const storage = moduleAt('lib/student-media-storage.ts', { 'server-only': {}, '@vercel/blob': {}, '@/lib/student-media': policy, '@/lib/workspace-logo-upload': signatures }, { fetch: async () => response });
    assert.equal(await storage.readStudentPhoto(source, 'a', 'profile'), null);
  }
});
