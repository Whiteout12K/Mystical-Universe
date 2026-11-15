import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {test} from 'node:test';
import {onRequestPost as backupRoute} from '../functions/api/player-backup.js';
import {checkPlayerBackup, makePlayerBackup, maxBackupBytes} from '../JScratch/js/player-save-format.mjs';
import {onRequestPost as login} from '../functions/api/login.js';
import {onRequestPost as logout} from '../functions/api/logout.js';
import {onRequestGet as load, onRequestPost as save} from '../functions/api/save.js';
import {onRequestGet as me} from '../functions/api/me.js';

function fixture(t) {
    const sql = new DatabaseSync(':memory:');
    t.after(() => sql.close());
    sql.exec(fs.readFileSync(new URL('../migrations/schema.sql', import.meta.url), 'utf8'));
    sql.exec(`INSERT INTO users (username, password, save_data)
        VALUES ('one','test-password','{"coins":10}'), ('two','other-password','{"coins":20}')`);
    const env = {DB: {prepare(query) {
        const stmt = sql.prepare(query);
        const bind = (...args) => ({
            first: async () => stmt.get(...args) ?? null,
            run: async () => ({meta: stmt.run(...args)})
        });
        return {...bind(), bind};
    }}};
    const context = (path, body, cookie = '', origin = 'https://game.test') => ({
        env,
        request: new Request('https://game.test/api/' + path, {
            method: body === undefined ? 'GET' : 'POST',
            headers: {Cookie: cookie, Origin: origin, 'Content-Type': 'application/json'},
            body: body === undefined ? undefined : JSON.stringify(body)
        })
    });
    const session = async (username = 'one', password = 'test-password') => {
        const result = await login(context('login', {username, password}));
        assert.equal(result.status, 200);
        const cookies = result.headers.getSetCookie();
        assert.match(cookies[1], /HttpOnly.*SameSite=Lax.*Secure/);
        return cookies.map(cookie => cookie.split(';')[0]).join('; ');
    };
    const backup = (action, cookie, body, revision) => backupRoute({env,
        request: new Request('https://game.test/api/player-backup?action=' + action, {
            method: 'POST', headers: {Cookie: cookie, 'Content-Type': 'text/plain',
                ...(revision ? {'If-Match': `"${revision}"`} : {})}, body
        })
    });
    return {context, session, backup};
}

test('D1 save uses the password-verified session, with no password in its response', async t => {
    const f = fixture(t);
    const cookie = await f.session();
    const state = await (await load(f.context('save', undefined, cookie))).json();
    assert.deepEqual(state.data, {coins: 10});
    assert.equal(state.username, 'one');
    assert.equal((await (await me(f.context('me', undefined, cookie))).json()).password, undefined);
    const body = {userId: state.userId, revision: state.revision, data: {coins: 13}};
    assert.equal((await save(f.context('save', body, 'username=one'))).status, 401);
    assert.equal((await save(f.context('save', body, cookie, 'https://other.test'))).status, 403);
    assert.equal((await save(f.context('save', {...body, userId: 2}, cookie))).status, 403);
    assert.equal((await save(f.context('save', body, cookie))).status, 200);
    assert.equal((await save(f.context('save', body, cookie))).status, 200, 'retry after a lost response is safe');
    assert.equal((await save(f.context('save', {...body, data: {coins: 11}}, cookie))).status, 409);
    assert.deepEqual((await (await load(f.context('save', undefined, cookie))).json()).data, {coins: 13});
    await logout(f.context('logout', {}, cookie));
    assert.equal((await save(f.context('save', body, cookie))).status, 401);
});

test('parallel cloud writes on the same revision cannot overwrite each other', async t => {
    const f = fixture(t);
    const cookie = await f.session();
    const {userId, revision} = await (await load(f.context('save', undefined, cookie))).json();
    const results = await Promise.all([21, 22].map(coins =>
        save(f.context('save', {userId, revision, data: {coins}}, cookie))));
    assert.deepEqual(results.map(response => response.status).sort(), [200, 409]);
});

test('Account exports verify against D1 and restore only the original backup for the signed-in owner', async t => {
    const f = fixture(t);
    const one = await f.session();
    const two = await f.session('two', 'other-password');
    assert.equal((await f.backup('export', 'username=one')).status, 401);
    const exported = await f.backup('export', one);
    assert.equal(exported.status, 200);
    assert.equal(exported.headers.get('Cache-Control'), 'no-store');
    const text = await exported.text();
    assert.deepEqual(JSON.parse(text), {format: 'jscratch-player-save', version: 2,
        source: 'd1', username: 'one', data: {coins: 10}});
    assert.equal((await f.backup('check', two, text)).status, 400);
    assert.equal((await f.backup('check', two, text.replace('"one"', '"two"'))).status, 422);
    assert.equal((await f.backup('check', one, text.replace('"coins":10', '"coins":9999'))).status, 422);
    assert.equal((await f.backup('check', one, makePlayerBackup('one', {coins: 10}))).status, 400);
    assert.equal((await f.backup('restore', one, text, 'unverified')).status, 409);
    assert.equal((await f.backup('check', one, 'x'.repeat(maxBackupBytes + 1))).status, 400);

    const previous = await (await f.backup('check', one, text)).json();
    assert.equal((await save(f.context('save', {
        userId: previous.userId, revision: previous.revision, data: {coins: 13}
    }, one))).status, 200);
    assert.equal((await f.backup('restore', one, text, previous.revision)).status, 409);
    const checked = await (await f.backup('check', one, text)).json();
    assert.equal((await f.backup('restore', one, text.replace('10', '99'), checked.revision)).status, 422);
    assert.deepEqual((await (await load(f.context('save', undefined, one))).json()).data, {coins: 13});
    const restored = await f.backup('restore', one, text, checked.revision);
    assert.equal(restored.status, 200);
    assert.deepEqual((await restored.json()).data, {coins: 10});
    assert.deepEqual((await (await load(f.context('save', undefined, one))).json()).data, {coins: 10});
    assert.deepEqual((await (await load(f.context('save', undefined, two))).json()).data, {coins: 20});
});

test('local backup checker accepts same-username exports and rejects invalid data without D1', () => {
    const portable = makePlayerBackup('local', {coins: 42, quest: [true, null]});
    assert.deepEqual(checkPlayerBackup(portable, 'local').data, {coins: 42, quest: [true, null]});
    assert.throws(() => checkPlayerBackup(portable, 'different'), /different username/);
    assert.throws(() => checkPlayerBackup(portable, 'local', {online: true}), /exported from Account/);
    assert.throws(() => checkPlayerBackup(portable.replace('42', '1e999'), 'local'), /invalid number/);
    assert.throws(() => checkPlayerBackup('["local"]', 'local'), /valid JScratch player backup/);
    assert.deepEqual(checkPlayerBackup(makePlayerBackup('local', {coins: 5}, true), 'local').data, {coins: 5});
});
