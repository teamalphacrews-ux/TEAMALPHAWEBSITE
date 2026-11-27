# Backend route and schema inventory

Inventory for the commercial release and its conditional legacy branches. Each line records a declared HTTP method and path. Registration alone establishes no runtime test result. The server selects the OAuth routes by deployment mode. Static uploads and Socket.IO are covered separately in the audit report.

## routes/adminUserRoutes.js

```text
DELETE /api/admin-users/:id
GET /api/admin-users
POST /api/admin-users/create
POST /api/admin-users/update-master
PUT /api/admin-users/:id
```

## routes/calendarRoutes.js

```text
DELETE /api/calendar/:id
GET /api/calendar
GET /api/calendar/sync-now
GET /api/calendar/sync-status
PATCH /api/calendar/:id
POST /api/calendar
POST /api/calendar/disconnect-google
```

## routes/chatRoutes.js

```text
DELETE /api/chats/:id/:mode
DELETE /api/chats/clear-history
GET /api/chats
GET /api/chats/admin/:userId
GET /api/chats/admin/conversations
GET /api/chats/search-users
GET /api/chats/unread
GET /api/chats/unread-summary
POST /api/chats
POST /api/chats/clear/:userId
POST /api/chats/clear/admin
POST /api/chats/react/:messageId
POST /api/chats/upload
PUT /api/chats/mark-as-seen
PUT /api/chats/read
```

## routes/contactRoutes.js

```text
GET /api/contacts
GET /api/contacts/:id
GET /api/studio-projects
GET /api/studio-projects/:id
PATCH /api/contact-documents/:id
PATCH /api/contacts/:id
PATCH /api/studio-projects/:id
PATCH /api/studio-projects/:id/crew
POST /api/contact-documents
POST /api/contacts
POST /api/studio-projects
POST /api/studio-projects/:id/notes
```

## routes/dashboardRoutes.js

```text
GET /api/dashboard/recent-activity
GET /api/dashboard/stats
GET /api/dashboard/studio-overview
GET /api/dashboard/upcoming-events
```

## routes/documentCoverRoutes.js

```text
POST /api/studio/document-covers
```

## routes/driveBackupRoutes.js

```text
GET /api/integrations/drive-backups/begin
GET /api/integrations/drive-backups/callback
GET /api/integrations/drive-backups/files
GET /api/integrations/drive-backups/files/:id/download
GET /api/integrations/drive-backups/status
POST /api/integrations/drive-backups/connect
POST /api/integrations/drive-backups/disconnect
POST /api/integrations/drive-backups/files
```

## routes/driveGalleryRoutes.js

```text
DELETE /api/drive-gallery/:id
DELETE /api/drive-gallery/events/:eventId
GET /api/drive-gallery
GET /api/drive-gallery/:clientId/events
GET /api/drive-gallery/:id
GET /api/drive-gallery/event/:eventId
GET /api/drive-gallery/files/:eventId
GET /api/drive-gallery/proxy/:fileId
GET /api/drive-gallery/users/clients
PATCH /api/drive-gallery/:id
PATCH /api/drive-gallery/events/:eventId
POST /api/drive-gallery
POST /api/drive-gallery/:clientId/events
POST /api/drive-gallery/verify/:id
POST /api/drive-gallery/verify/search
```

## routes/financeRoutes.js

```text
DELETE /api/finance/expense/:id
DELETE /api/finance/income/:incomeType/:id
GET /api/finance/allocation
GET /api/finance/monthly-performance
GET /api/finance/overview
GET /api/finance/pending-payments
GET /api/finance/transactions
POST /api/finance
POST /api/finance/expense
PUT /api/finance/expense/:id
```

## routes/galleryRoutes.js

```text
DELETE /api/gallery/:id
DELETE /api/gallery/folder/:folderName
DELETE /api/gallery/folder/:folderName/category/:categoryName
GET /api/gallery
PATCH /api/gallery/:id
PATCH /api/gallery/:id/cover
PATCH /api/gallery/:id/favorite
PATCH /api/gallery/:id/select
PATCH /api/gallery/rename-category
PATCH /api/gallery/rename-folder
POST /api/gallery
POST /api/gallery/upload
```

## routes/gmailRoutes.js

```text
GET /api/integrations/gmail/begin
GET /api/integrations/gmail/callback
GET /api/integrations/gmail/messages
GET /api/integrations/gmail/messages/:id
GET /api/integrations/gmail/status
POST /api/integrations/gmail/connect
POST /api/integrations/gmail/disconnect
```

## routes/googleSheetRoutes.js

```text
DELETE /api/google-sheets/column/:colIndex
DELETE /api/google-sheets/row/:rowId
GET /api/google-sheets
GET /api/google-sheets/config/dropdowns
POST /api/google-sheets/column
POST /api/google-sheets/config/dropdowns
POST /api/google-sheets/row
PUT /api/google-sheets/batch-update
PUT /api/google-sheets/cell
```

## routes/invoiceRoutes.js

```text
DELETE /api/invoices/:id
DELETE /api/invoices/:id/scheduled-delivery
DELETE /api/invoices/:id/share
GET /api/invoices
GET /api/invoices/:id
GET /api/invoices/delivery-status
GET /api/invoices/register
POST /api/invoices
POST /api/invoices/:id/approve
POST /api/invoices/:id/duplicate
POST /api/invoices/:id/send
POST /api/invoices/:id/share
POST /api/invoices/:id/share/regenerate
PUT /api/invoices/:id
```

## routes/leadroutes.js

```text
DELETE /api/leads/:id
GET /api/leads
PATCH /api/leads/:id
POST /api/leads
POST /api/leads/:id/project
POST /api/leads/:id/remind/:photographerName
POST /api/leads/:id/tasks
```

## routes/media.js

```text
DELETE /api/media/:id
GET /api/media/files
GET /api/media/files/:clientId
GET /api/media/folder/:folderId
POST /api/media/drive-collection
POST /api/media/upload
```

## routes/notificationRoutes.js

```text
DELETE /api/notifications/:id
DELETE /api/notifications/clear-all
GET /api/notifications
PATCH /api/notifications/:id/read
POST /api/notifications/create
POST /api/notifications/mark-all-read
```

## routes/photographerRoutes.js

```text
DELETE /api/photographers/:id
GET /api/photographers
GET /api/photographers/:name/works
PATCH /api/photographers/:id
POST /api/photographers
```

## routes/projectSupportRoutes.js

```text
GET /api/project-support
GET /api/project-support/:id/messages
GET /api/project-support/unread
POST /api/project-support/:id/messages
```

## routes/publicInvoiceRoutes.js

```text
GET /api/public-invoices/:token
```

## routes/publicProjectRoutes.js

```text
GET /api/quotes/:token/messages
GET /api/quotes/:token/project
POST /api/quotes/:token/messages
```

## routes/publicQuoteRoutes.js

```text
GET /api/quotes/:token
POST /api/quotes/:token/accept
```

## routes/quoteWorkflowRoutes.js

```text
DELETE /api/studio/quotations/:id/schedule
DELETE /api/studio/quotations/:id/share
DELETE /api/studio/quote-templates/:id
GET /api/studio/quotations/:id/client-link
GET /api/studio/quotations/:id/email-history
GET /api/studio/quotations/:id/preview
GET /api/studio/quote-templates
PATCH /api/studio/quotations/:id/number
PATCH /api/studio/quotations/:id/project
POST /api/studio/quotations/:id/archive
POST /api/studio/quotations/:id/cancel
POST /api/studio/quotations/:id/duplicate
POST /api/studio/quotations/:id/email
POST /api/studio/quotations/:id/schedule
POST /api/studio/quotations/:id/share
POST /api/studio/quotations/:id/share/regenerate
POST /api/studio/quote-templates
PUT /api/studio/quotations/:id/settings
PUT /api/studio/quote-templates/:id
```

## routes/receiptRoutes.js

```text
GET /api/studio/ledger/:id/receipt
POST /api/studio/ledger/:id/receipt
```

## routes/studioArchiveRoutes.js

```text
GET /api/studio/security/workspace-backups
GET /api/studio/security/workspace-backups/:id/download
GET /api/studio/security/workspace-data
POST /api/studio/security/workspace-backups
POST /api/studio/security/workspace-reset
POST /api/studio/security/workspace-restore
POST /api/studio/security/workspace-restore/inspect
POST /api/studio/security/workspace-resume
```

## routes/studioAssistantRoutes.js

```text
GET /api/integrations/assistants/status
POST /api/integrations/assistants/:provider/draft
POST /api/integrations/assistants/:provider/test
```

## routes/studioCommunicationRoutes.js

```text
GET /api/studio/email/status
POST /api/studio/email/test
```

## routes/studioDeviceRoutes.js

```text
DELETE /api/studio/devices/:installationId
GET /api/studio/devices/status
POST /api/studio/devices
```

## routes/studioPreferencesRoutes.js

```text
GET /api/studio/preferences
PATCH /api/studio/preferences
```

## routes/studioProfileRoutes.js

```text
GET /api/studio/profile-images/:id
POST /api/studio/profile-images
```

## routes/studioRoutes.js

```text
DELETE /api/studio/assets/:id
DELETE /api/studio/ledger/:id
GET /api/studio/assets
GET /api/studio/clients
GET /api/studio/finance
GET /api/studio/quotations
GET /api/studio/settings
PATCH /api/studio/booking-payments/:id
PATCH /api/studio/clients/:id
POST /api/studio/assets
POST /api/studio/clients
POST /api/studio/ledger
POST /api/studio/quotations
PUT /api/studio/assets/:id
PUT /api/studio/ledger/:id
PUT /api/studio/quotations/:id
PUT /api/studio/settings
```

## routes/studioSecurityRoutes.js

```text
DELETE /api/studio/security/sessions/:id
GET /api/studio/security/access
GET /api/studio/security/backups
GET /api/studio/security/backups/:id/download
GET /api/studio/security/recovery
GET /api/studio/security/sessions
POST /api/studio/security/activity
POST /api/studio/security/backups
POST /api/studio/security/backups/:id/restore
POST /api/studio/security/logout
POST /api/studio/security/recovery/:id/restore
POST /api/studio/security/sessions/revoke-all
```

## routes/taskRoutes.js

```text
DELETE /api/tasks/:id
GET /api/tasks
PATCH /api/tasks/:id
POST /api/tasks
POST /api/tasks/apply-template
```

## routes/webhookRoutes.js

```text
GET /api/webhooks/enquiries/status
POST /api/webhooks/enquiries
```

## routes/whatsappRoutes.js

```text
GET /api/integrations/whatsapp/conversations
GET /api/integrations/whatsapp/conversations/:id
GET /api/integrations/whatsapp/status
GET /api/integrations/whatsapp/templates
GET /api/integrations/whatsapp/webhook
POST /api/integrations/whatsapp/conversations
POST /api/integrations/whatsapp/conversations/:id/messages
POST /api/integrations/whatsapp/conversations/:id/read
POST /api/integrations/whatsapp/verify
POST /api/integrations/whatsapp/wabb/messages
POST /api/integrations/whatsapp/webhook
PUT /api/integrations/whatsapp/conversations/:id/consent
PUT /api/integrations/whatsapp/conversations/:id/link
```

## routes/workspaceSearchRoutes.js

```text
GET /api/studio/search
```

## saas/routes.js

```text
DELETE /api/saas/invitations/:id
GET /api/saas/config
GET /api/saas/invitations/:token
GET /api/saas/setup
GET /api/saas/workspace
GET /api/saas/workspaces
PATCH /api/saas/members/:id
PATCH /api/saas/setup
POST /api/saas/billing/checkout
POST /api/saas/billing/verify
POST /api/saas/billing/webhook
POST /api/saas/invitations
POST /api/saas/invitations/:token/accept
POST /api/saas/login
POST /api/saas/setup/complete
POST /api/saas/setup/restart
POST /api/saas/signup
POST /api/saas/workspaces
POST /api/saas/workspaces/:id/switch
```

## saas/socialRoutes.js

```text
GET /api/saas/oauth/google/callback
POST /api/saas/oauth/:provider/start
POST /api/saas/oauth/apple/callback
POST /api/saas/oauth/complete
```

## server.js

```text
GET /
GET /api/auth/google
GET /api/auth/google/begin
GET /api/auth/google/callback
GET /api/auth/me
GET /api/health
GET /api/saas/oauth/google/callback
POST /api/auth/google/webhook
POST /api/auth/login
POST /api/auth/register
POST /api/calendar/connect
PUT /api/auth/profile
```

## Database models

Mongoose schema declarations, grouped by collection. MongoDB also supplies the standard unique document ID index. Relationships below are declared Mongoose references. Plain string and application-managed associations require service-level validation.

| Model | Collection | Declared references | Secondary indexes and options |
|---|---|---|---|
| AdminSession | adminsessions | user → User | tokenHash 1 (unique); user 1; expiresAt 1 (TTL 0s) |
| AdminSettings | adminsettings | — | — |
| AssetRecord | assetrecords | lead → Lead | — |
| ChatRoom | chatrooms | — | userId 1 (unique) |
| ContactDocument | contactdocuments | contactId → StudioContact; studioProjectId → StudioProject | contactId 1, studioProjectId 1 |
| DocumentCounter | documentcounters | — | — |
| DriveBackupConnection | drivebackupconnections | userId → User | userId 1 (unique) |
| DriveBackupOAuthNonce | drivebackupoauthnonces | userId → User | expiresAt 1 (TTL 0s) |
| DriveGallery | drivegalleries | clientId → User | driveFolderId 1 (unique) (sparse) |
| Event | events | contactId → StudioContact; studioProjectId → StudioProject; lead → Lead; photos → Gallery; userId → User | googleEventId 1 (unique) (sparse) |
| Finance | finances | studioProjectId → StudioProject | — |
| FinanceReceipt | financereceipts | financeId → Finance; uploadedBy → User | financeId 1 (unique) |
| Gallery | galleries | — | — |
| GalleryEvent | galleryevents | clientId → DriveGallery | — |
| GmailConnection | gmailconnections | userId → User | userId 1 (unique) |
| GmailOAuthNonce | gmailoauthnonces | userId → User | expiresAt 1 (TTL 0s) |
| Invoice | invoices | sourceQuotation → Quotation; contactId → StudioContact; leadId → Lead; studioProjectId → StudioProject | sourceQuotation 1 (unique) (when {"sourceQuotation":{"$type":"objectId"}}); shareTokenHash 1 (unique) (sparse); documentNumber 1; createdAt -1, _id -1; invoiceDate -1, _id 1 |
| Lead | leads | contactId → StudioContact; studioProjectId → StudioProject; quotationId → Quotation; tasks → Task | webhookEventId 1 (unique) (sparse); studioProjectId 1 (unique) (when {"studioProjectId":{"$type":"objectId"}}) |
| ManualCreationReceipt | manualcreationreceipts | — | — |
| Media | media | — | fileId 1 (unique) |
| Message | messages | replyTo → Message | — |
| Notification | notifications | — | eventKey 1 (unique) (sparse) |
| Photographer | photographers | — | email 1 (unique) |
| ProjectMessage | projectmessages | quotation → Quotation | quotation 1; quotation 1, author 1, requestId 1 (unique); quotation 1, createdAt -1, _id -1 |
| Quotation | quotations | invoiceId → Invoice; contactId → StudioContact; studioProjectId → StudioProject; lead → Lead | shareTokenHash 1 (unique) (when {"shareTokenHash":{"$type":"string"}}); documentNumber 1 (unique) (when {"documentNumber":{"$type":"string"}}) |
| QuoteDelivery | quotedeliveries | quotation → Quotation | key 1 (unique); status 1, dueAt 1 |
| QuoteTemplate | quotetemplates | — | — |
| RecoveryRecord | recoveryrecords | deletedBy → User | expiresAt 1 (TTL 0s) |
| SaaSAccount | saasaccounts | — | email 1 (unique); oauthProvider 1, oauthSubject 1 (unique) (when {"oauthProvider":{"$exists":true},"oauthSubject":{"$exists":true}}) |
| SaaSBillingEvent | saasbillingevents | — | — |
| SaaSCalendarBinding | saascalendarbindings | — | — |
| SaaSInvitation | saasinvitations | workspaceId → SaaSWorkspace | tokenHash 1 (unique); workspaceId 1, email 1 (unique) (when {"state":"pending"}) |
| SaaSMembership | saasmemberships | workspaceId → SaaSWorkspace; accountId → SaaSAccount | workspaceId 1, accountId 1 (unique) |
| SaaSOAuthFlow | saasoauthflows | — | stateHash 1 (unique); ticketHash 1 (unique) (sparse); expiresAt 1 (TTL 0s) |
| SaaSWorkspace | saasworkspaces | ownerAccountId → SaaSAccount | slug 1 (unique); databaseName 1 (unique) |
| SheetConfig | sheetconfigs | — | type 1 (unique) |
| StudioArchive | studioarchives | createdBy → User | expiresAt 1 (TTL 0s) |
| StudioArchiveChunk | studioarchivechunks | archive → StudioArchive | archive 1; expiresAt 1 (TTL 0s); archive 1, index 1 (unique) |
| StudioArchiveState | studioarchivestates | — | — |
| StudioBackup | studiobackups | createdBy → User | slot 1 (unique) (sparse); expiresAt 1 (TTL 0s) |
| StudioConfig | studioconfigs | — | key 1 (unique) |
| StudioContact | studiocontacts | — | email 1 |
| StudioOperationLease | studiooperationleases | — | expiresAt 1 (TTL 0s) |
| StudioProfileImage | studioprofileimages | uploadedBy → User | — |
| StudioProject | studioprojects | contactId → StudioContact; leadId → Lead; additionalClients → StudioContact | contactId 1 |
| StudioPushDevice | studiopushdevices | — | tokenHash 1 (unique); installationId 1; workspaceKey 1; userId 1; expiresAt 1 (TTL 0s); installationId 1, workspaceKey 1, userId 1 |
| Task | tasks | lead → Lead; assignee → Photographer | lead 1, templateKey 1 (unique) (when {"lead":{"$type":"objectId"},"templateKey":{"$type":"string"}}) |
| User | users | leadId → Lead | email 1 (unique) |
| WabbMessageAttempt | wabbmessageattempts | attemptedBy → User | workspaceId 1, requestId 1 (unique); workspaceId 1, createdAt -1 |
| WhatsAppConnection | whatsappconnections | verifiedBy → User | key 1 (unique) |
| WhatsAppConversation | whatsappconversations | contactId → StudioContact; leadId → Lead; optInBy → User | phoneNumberId 1, waId 1 (unique); phoneNumberId 1, lastMessageAt -1, _id -1; phoneNumberId 1, lastInboundReceivedAt -1 |
| WhatsAppMessage | whatsappmessages | conversation → WhatsAppConversation; canonicalMessageId → WhatsAppMessage; actor → User | phoneNumberId 1, providerId 1 (unique) (when {"providerId":{"$type":"string"}}); phoneNumberId 1, requestId 1 (unique) (when {"requestId":{"$type":"string"}}); conversation 1, createdAt -1, _id -1 |
| WhatsAppReceipt | whatsappreceipts | — | phoneNumberId 1, providerId 1, eventType 1 |

Counted 279 route declarations and 53 models. The legacy unmounted router in `backend/routes/auth.js` is excluded.
