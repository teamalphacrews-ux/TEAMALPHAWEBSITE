import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import * as jsxRuntime from 'react/jsx-runtime';
import * as moduleAccess from '../src/utils/moduleAccess.js';
import * as workspaceActions from '../src/utils/workspaceActions.js';

test('switching the requested client remounts the draft, while unrelated query or data refreshes retain its identity', () => {
  let params, refreshing = false;
  const clients = ['a', 'b'].map(_id => ({ _id, firstName: _id }));
  const mocks = {
    react: {
      useState: value => [typeof value === 'function' ? value() : value, () => {}],
      useMemo: compute => compute(),
    },
    'react/jsx-runtime': jsxRuntime,
    'react-router-dom': { useSearchParams: () => [params], useNavigate: () => () => {} },
    '../../context/AuthContext': { useAuth: () => ({ user: { studioOwner: true } }) },
    '../../utils/moduleAccess': moduleAccess,
    '../../utils/workspaceActions': workspaceActions,
    '../../saas/release': { IS_COMMERCIAL_DEPLOYMENT: true },
    '../components/operations/workspaceData': { useWorkspaceData: paths => ({ data: paths.map(path => path === '/api/contacts' ? clients : []), loading: refreshing }) },
    '../components/contacts/ContactWorkflowUI': { ProjectForm: 'ProjectForm', ContactForm: 'ContactForm' },
  };
  const module = { exports: {} };
  const source = readFileSync(new URL('../src/admin/pages/StudioProjects.jsx', import.meta.url), 'utf8');
  runInNewContext(transformSync(source, { loader: 'jsx', jsx: 'automatic', format: 'cjs' }).code, {
    module, require: name => mocks[name] || {}, URLSearchParams,
  });
  function draft(query) {
    params = new URLSearchParams(query);
    const page = module.exports.default();
    const flow = page.props.children.find(child => child?.props && 'requestedClient' in child.props);
    const form = flow.type(flow.props);
    return { flowKey: flow.key, formKey: form.key, client: form.props.contact?._id };
  }
  const first = draft('new=1&contact=a');
  assert.equal(first.client, 'a');
  refreshing = true;
  assert.deepEqual(draft('new=1&contact=a&view=grid'), first);
  const second = draft('new=1&contact=b');
  assert.equal(second.client, 'b');
  assert.notEqual(first.flowKey, second.flowKey);
  assert.notEqual(first.formKey, second.formKey);
  assert.equal(draft('new=1').client, undefined);
});
