const test = require('node:test');
const assert = require('node:assert/strict');
const Event = require('../models/Event');
const Lead = require('../models/Lead');
const Photographer = require('../models/Photographer');
const Task = require('../models/Task');
const recovery = require('../services/studioRecovery');
const { deletePhotographer } = require('../controllers/photographerController');

const actorId = '507f1f77bcf86cd799439012';
const member = { _id: '507f1f77bcf86cd799439011', name: 'Alex (A+B).' };
const request = (id = member._id) => ({ params: { id }, user: { id: actorId } });
const response = () => ({
    statusCode: 200,
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
});

for (const linkedModel of [null, Task, Event, Lead]) {
    test('crew deletion checks ' + (linkedModel ? linkedModel.modelName + ' assignments' : 'unassigned roster members'), async (t) => {
        const session = {};
        let deleted = false;
        t.mock.method(recovery, 'recoverableDelete', async ({ Model, filter, actorId: actor, beforeDelete }) => {
            assert.equal(Model, Photographer);
            assert.deepEqual(filter, { _id: member._id });
            assert.equal(actor, actorId);
            await beforeDelete({ row: member, session });
            deleted = true;
            return member;
        });

        for (const [Model, field] of [[Task, 'assignee'], [Event, 'teamMembers'], [Lead, 'people']]) {
            t.mock.method(Model, 'exists', (filter) => ({
                async session(value) {
                    assert.equal(value, session);
                    if (Model === Task) assert.deepEqual(filter, { assignee: member._id });
                    else {
                        assert.match(' alex (a+b). ', filter[field]);
                        assert.doesNotMatch('Alex AAB!', filter[field]);
                        assert.doesNotMatch('New Alex (A+B).', filter[field]);
                    }
                    return Model === linkedModel ? { _id: member._id } : null;
                },
            }));
        }

        const res = response();
        await deletePhotographer(request(), res);
        assert.equal(res.statusCode, linkedModel ? 409 : 200);
        assert.equal(deleted, !linkedModel);
        if (linkedModel) assert.match(res.body.message, /Inactive/);
    });
}

test('crew deletion rejects malformed identities and reports missing or restricted records', async (t) => {
    let missing = true;
    const remove = t.mock.method(recovery, 'recoverableDelete', async () => {
        if (missing) return null;
        throw Object.assign(new Error('Deletion is restricted.'), { status: 403 });
    });

    const malformed = response();
    await deletePhotographer(request('not-a-record'), malformed);
    assert.equal(malformed.statusCode, 400);
    assert.equal(remove.mock.callCount(), 0);

    const gone = response();
    await deletePhotographer(request(), gone);
    assert.equal(gone.statusCode, 404);

    missing = false;
    const denied = response();
    await deletePhotographer(request(), denied);
    assert.equal(denied.statusCode, 403);
    assert.equal(denied.body.message, 'Deletion is restricted.');
});
