const test = require('node:test');
const assert = require('node:assert/strict');
const { createLeadHandler } = require('../utils/createLead');

const body = { name: 'Couple', email: 'couple@example.com', createAccount: true,
    firstName: 'Client', lastName: 'User', accountEmail: 'CLIENT@example.com', password: 'temporary-password' };

function fixture(options = {}) {
    const state = { leads: new Map(), users: new Map(), leadSaves: 0, notifications: 0, cleanup: [] };
    class Lead {
        constructor(data) { Object.assign(this, { _id: 'new-lead', status: 'New' }, data); }
        async validate() {}
        async save() { state.leadSaves++; state.leads.set(this._id, this); }
        static async findByIdAndDelete(id) {
            state.cleanup.push({ leadId: id });
            if (options.cleanupFailure) throw new Error('storage unavailable');
            state.leads.delete(id);
        }
    }
    class User {
        constructor(data) { Object.assign(this, { _id: 'new-user' }, data); }
        async validate() {}
        async save() {
            if (options.persistUserBeforeFailure) state.users.set(this._id, this);
            if (options.accountFailure) throw options.accountFailure;
            state.users.set(this._id, this);
        }
        static async findOne(query) {
            if (options.existingEmail && query.email.test(options.existingEmail)) return { _id: 'existing-user' };
            return null;
        }
        static async deleteOne(query) {
            state.cleanup.push({ user: query });
            const user = state.users.get(query._id);
            if (user?.leadId === query.leadId) state.users.delete(query._id);
        }
    }
    const Notification = { async create() {
        state.notifications++;
        if (options.notificationFailure) throw new Error('notification storage unavailable');
    } };
    const bcrypt = { genSalt: async () => 'test-salt', hash: async () => 'hashed-test-password' };
    const allowedLeadFields = data => Object.fromEntries(Object.entries(data).filter(([field]) => ['name', 'email', 'status', 'galleryTag', 'cloudLink', 'cloudPassword'].includes(field)));
    const handler = createLeadHandler({ Lead, User, Notification, bcrypt, allowedLeadFields, logger: { error() {} } });
    return { state, handler };
}

async function invoke(handler, input = body) {
    let output;
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; },
        json(body) { output = { status: this.statusCode, body }; return this; } };
    await handler({ body: input }, res);
    return output;
}

test('duplicate portal email is rejected before saving an enquiry or creating an account', async () => {
    const { state, handler } = fixture({ existingEmail: 'Client@Example.com' });
    const response = await invoke(handler);
    assert.equal(response.status, 409);
    assert.equal(state.leadSaves, 0);
    assert.equal(state.leads.size, 0);
    assert.equal(state.users.size, 0);
    assert.equal(state.notifications, 0);
});

test('portal account inputs are validated before inserting the enquiry', async () => {
    for (const invalid of [{ ...body, firstName: '' }, { ...body, lastName: '  ' },
        { ...body, accountEmail: 'invalid' }, { ...body, password: '' },
        { ...body, password: 'x'.repeat(73) }, { ...body, createAccount: 'true' }]) {
        const { state, handler } = fixture();
        assert.equal((await invoke(handler, invalid)).status, 400);
        assert.equal(state.leadSaves, 0);
        assert.equal(state.users.size, 0);
    }
});

test('account insert failures compensate the new lead; a uniqueness race never removes the existing user', async () => {
    for (const [error, expectedStatus] of [[Object.assign(new Error('duplicate email'), { code: 11000 }), 409],
        [new Error('account insert failed'), 500]]) {
        const { state, handler } = fixture({ accountFailure: error });
        state.users.set('existing-user', { _id: 'existing-user', email: 'client@example.com', leadId: 'older-lead' });
        const response = await invoke(handler);
        assert.equal(response.status, expectedStatus);
        assert.equal(state.leads.size, 0);
        assert.equal(state.users.size, 1);
        assert.equal(state.users.has('existing-user'), true);
        assert.deepEqual(state.cleanup, [{ user: { _id: 'new-user', leadId: 'new-lead' } }, { leadId: 'new-lead' }]);
        assert.equal(state.notifications, 0);
    }
});

test('account insertion with ambiguous acknowledgement compensates both records from this attempt', async () => {
    const { state, handler } = fixture({ accountFailure: new Error('acknowledgement lost'), persistUserBeforeFailure: true });
    assert.equal((await invoke(handler)).status, 500);
    assert.equal(state.leads.size, 0);
    assert.equal(state.users.size, 0);
});

test('notification failure preserves a successful enquiry and optional linked account', async () => {
    for (const createAccount of [false, true]) {
        const { state, handler } = fixture({ notificationFailure: true });
        const response = await invoke(handler, { ...body, createAccount });
        assert.equal(response.status, 200);
        assert.equal(response.body._id, 'new-lead');
        assert.equal(state.leads.size, 1);
        assert.equal(state.users.size, createAccount ? 1 : 0);
        assert.equal(state.cleanup.length, 0);
        assert.equal(response.body.password, undefined);
        if (createAccount) {
            const account = state.users.get('new-user');
            assert.equal(account.leadId, 'new-lead');
            assert.equal(account.role, 'client');
            assert.equal(account.email, 'client@example.com');
            assert.equal(account.password, 'hashed-test-password');
        }
    }
});

test('unconfirmed compensation returns the enquiry ID for inspection before retrying', async () => {
    const { state, handler } = fixture({ accountFailure: new Error('insert failed'), cleanupFailure: true });
    const response = await invoke(handler);
    assert.equal(response.status, 503);
    assert.equal(response.body.leadId, 'new-lead');
    assert.match(response.body.error, /before retrying/);
    assert.equal(state.notifications, 0);
});
