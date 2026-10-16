function profileError(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function parseProfileUpdate(body, currentRole) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw profileError('A profile object is required');
    }
    // Older profile forms send the current role with the name. Accept that
    // unchanged value, but role management belongs to the admin-users API.
    if (Object.hasOwn(body, 'role') && body.role !== currentRole) {
        throw profileError('Roles cannot be changed through the profile endpoint', 403);
    }
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 120) {
        throw profileError('Display name must contain between 1 and 120 characters');
    }
    const [firstName, ...rest] = body.name.trim().split(/\s+/);
    const update = { firstName };
    // A one-word display name preserves the existing surname in the database.
    if (rest.length) update.lastName = rest.join(' ');
    return update;
}

module.exports = { parseProfileUpdate };
