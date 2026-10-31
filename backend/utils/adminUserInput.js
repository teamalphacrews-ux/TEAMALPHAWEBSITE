const fail = message => Object.assign(new Error(message), { status: 400 });
const normalizeEmail = email => typeof email === 'string' ? email.trim().toLowerCase() : '';
const emailPattern = email => '^' + email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$';

function parseAdminUserInput(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail('Enter the team member’s details.');
  const result = {};
  for (const field of ['firstName', 'lastName']) {
    if (partial && body[field] === undefined) continue;
    const value = body[field] ?? '';
    if (typeof value !== 'string' || value.trim().length > 120 || (field === 'firstName' && !value.trim())) throw fail('Enter a first name of up to 120 characters. Last name is optional.');
    result[field] = value.trim();
  }
  if (!partial || body.email !== undefined) {
    const email = normalizeEmail(body.email);
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail('Enter a valid email address.');
    result.email = email;
  }
  if (!partial || (body.password !== undefined && body.password !== '' && body.password !== '••••••••')) {
    if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 256) throw fail('Use a password between 8 and 256 characters.');
    result.password = body.password;
  }
  if (body.role !== undefined) {
    if (!['admin', 'client'].includes(body.role)) throw fail('Choose a valid account role.');
    result.role = body.role;
  }
  return result;
}

module.exports = { parseAdminUserInput, emailPattern };
