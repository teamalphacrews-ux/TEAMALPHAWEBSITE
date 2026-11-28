// Isolated HTTP fixture. The parent supplies only temporary test configuration.
const express = require('express');
const mongoose = require('mongoose');
const archiveGate = require('../services/studioArchiveGate');
if (process.env.STUDIO_JOURNEY_WRITE_FENCE === 'true') archiveGate.installWriteFence(mongoose);
require('../saas/tenantModels').installTenantModels(mongoose);
const app = express();
app.use(express.json());
app.use('/api', require('../saas/access').createWorkspaceMiddleware());
app.use('/api', require('../saas/publicTokens').createPublicWorkspaceMiddleware());
app.use('/api', archiveGate.middleware());
app.use('/api/studio-projects', async (req, _res, next) => {
  if (req.method === 'POST' && req.get('x-journey-pause') === 'project-create') {
    // Hold the genuine HTTP shared lease while the parent races a contact delete.
    await new Promise(resolve => {
      process.once('message', resolve);
      process.send('project-create-ready');
    });
  }
  next();
});
app.use('/api/saas', require('../saas/routes'));
const { createStudioAssistantRouter } = require('../routes/studioAssistantRoutes');
const { createStudioAssistantService } = require('../services/studioAssistantService');
const testAssistant = createStudioAssistantService({ fetchImpl: async (url, options) => {
  if (url !== 'https://api.openai.com/v1/responses') throw new Error('Unexpected provider in the local fixture');
  const { model } = JSON.parse(options.body);
  if (options.headers.Authorization !== 'Bearer fixture-key-for-' + model) throw new Error('Wrong studio credential');
  return Response.json({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'A local draft from ' + model }] }] });
} });
app.use('/api/integrations/assistants', createStudioAssistantRouter({ service: testAssistant }));
app.use('/api/integrations/gmail', require('../routes/gmailRoutes'));
app.use('/api/leads', require('../routes/leadroutes'));
app.use('/api/calendar', (req, _res, next) => { req.io = { to: () => ({ emit() {} }) }; next(); }, require('../routes/calendarRoutes'));
app.use('/api/tasks', require('../routes/taskRoutes'));
app.use('/api/photographers', require('../routes/photographerRoutes'));
app.use('/api/dashboard', require('../routes/dashboardRoutes'));
app.use('/api/gallery', require('../routes/galleryRoutes'));
app.use('/api/studio/security', require('../routes/studioSecurityRoutes'));
app.use('/api/studio', require('../routes/quoteWorkflowRoutes'));
app.use('/api/studio', require('../routes/studioRoutes'));
app.use('/api/studio', require('../routes/studioPreferencesRoutes'));
app.use('/api/quotes', require('../routes/publicQuoteRoutes'));
app.use('/api/invoices', require('../routes/invoiceRoutes'));
app.use('/api/finance', require('../routes/financeRoutes'));
app.use('/api/notifications', require('../routes/notificationRoutes'));
app.use('/api', require('../routes/contactRoutes'));
const port = Number(process.argv[2]);
if (!process.send || !Number.isInteger(port) || port < 1024 || port > 65535 || process.env.NODE_ENV !== 'test') {
  throw new Error('Run this fixture from workspaceJourney.test.js');
}
mongoose.connect('mongodb://127.0.0.1:' + port + '/audit_registry?replicaSet=studioAudit').then(() => {
  const server = app.listen(0, '127.0.0.1', () => process.send(server.address().port));
  process.on('disconnect', async () => {
    server.closeAllConnections();
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  });
}).catch(() => process.exit(1));
