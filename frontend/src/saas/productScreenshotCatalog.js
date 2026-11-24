// Fresh captures of the isolated fictional sample workspace. No private or live client data.
import { CLIENT_SMART_LINK_SCREENSHOT, PRODUCT_SCREEN_ROOT, resolveCaptureImage } from './productClientCaptureData.js';

const files = (id, theme, mobile = false) => ({
  desktop: `${PRODUCT_SCREEN_ROOT}${id}-${theme}-desktop.webp`,
  desktop2x: `${PRODUCT_SCREEN_ROOT}${id}-${theme}-desktop@2x.webp`,
  ...(mobile ? { mobile2x: `${PRODUCT_SCREEN_ROOT}${id}-${theme}-mobile@2x.webp` } : {}),
});

function workspaceScreen(id, title, description) {
  return { id, title, description, alt: description, width: 1440, height: 960,
    mobileWidth: 390, mobileHeight: 844, light: files(id, 'light', true), dark: files(id, 'dark', true) };
}

function clientChapter(view, title, description) {
  return { id: 'client-smart-link-' + view, title, description, alt: description, width: 1440, height: 960,
    mobileWidth: 390, mobileHeight: 844, light: resolveCaptureImage(view, 'light'), dark: resolveCaptureImage(view, 'dark') };
}

export const PRODUCT_SCREENSHOTS = {
  crew: workspaceScreen('crew', 'Crew', 'The sample studio’s production crew roster.'),
  'project-delivery': workspaceScreen('project-delivery', 'Project delivery', 'Deliverables and production progress for a sample wedding project.'),
  reminders: workspaceScreen('reminders', 'Reminders & alerts', 'Personal reminder and notification settings in the sample studio workspace.'),
  'studio-brand': workspaceScreen('studio-brand', 'Studio branding', 'The studio identity and branding settings in Studio X OS.'),
  'client-smart-link-quote': clientChapter('quote', 'Client quotation', 'A quotation opened in the sample client’s Smart Link.'),
  'client-smart-link-payments': clientChapter('payments', 'Client payment schedule', 'Payment milestones in the sample client’s private Smart Link.'),
  "enquiries": { id: "enquiries", title: "Enquiries", description: "Fictional enquiries in the first stage of the studio workflow, with follow-up and quotation status.", alt: "Studio X OS — Enquiries. Fictional sample workspace.", width: 1440, height: 960, light: files("enquiries", "light"), dark: files("enquiries", "dark") },
  "overview": { id: "overview", title: "Overview", description: "The Today overview with sample studio priorities, work status and schedule.", alt: "Studio X OS \u2014 Overview. Fictional sample workspace.", width: 1440, height: 960, mobileWidth: 390, mobileHeight: 844, light: files("overview", "light", true), dark: files("overview", "dark", true) },
  "finance": { id: "finance", title: "Finance", description: "Fictional collections, invoice balances and payment priorities in the finance workspace.", alt: "Studio X OS \u2014 Finance. Fictional sample workspace.", width: 1440, height: 960, mobileWidth: 390, mobileHeight: 844, light: files("finance", "light", true), dark: files("finance", "dark", true) },
  "production": { id: "production", title: "Post-production", description: "Sample photography and film tasks with assigned people and delivery stages.", alt: "Studio X OS \u2014 Post-production. Fictional sample workspace.", width: 1440, height: 960, mobileWidth: 390, mobileHeight: 844, light: files("production", "light", true), dark: files("production", "dark", true) },
  "contacts": { id: "contacts", title: "Contacts", description: "Fictional client records in the contacts workspace.", alt: "Studio X OS \u2014 Contacts. Fictional sample workspace.", width: 1440, height: 960, light: files("contacts", "light", false), dark: files("contacts", "dark", false) },
  "contact-form": { id: "contact-form", title: "Add contact", description: "The actual contact form for identity and contact details, shown before saving.", alt: "Studio X OS \u2014 Add contact. Fictional sample workspace.", width: 1440, height: 960, light: files("contact-form", "light", false), dark: files("contact-form", "dark", false) },
  "contact-detail": { id: "contact-detail", title: "Client details", description: "One fictional client with linked projects, conversations, documents, payments and sessions.", alt: "Studio X OS \u2014 Client details. Fictional sample workspace.", width: 1440, height: 960, light: files("contact-detail", "light", false), dark: files("contact-detail", "dark", false) },
  "projects": { id: "projects", title: "Projects", description: "Sample projects connected to their clients, event dates and work.", alt: "Studio X OS \u2014 Projects. Fictional sample workspace.", width: 1440, height: 960, light: files("projects", "light", false), dark: files("projects", "dark", false) },
  "project-detail": { id: "project-detail", title: "Project details", description: "A fictional wedding project with linked documents, production and assigned people.", alt: "Studio X OS \u2014 Project details. Fictional sample workspace.", width: 1440, height: 960, light: files("project-detail", "light", false), dark: files("project-detail", "dark", false) },
  "quotations": { id: "quotations", title: "Quotations", description: "The quotation list with fictional sample client records and statuses.", alt: "Studio X OS \u2014 Quotations. Fictional sample workspace.", width: 1440, height: 960, light: files("quotations", "light", false), dark: files("quotations", "dark", false) },
  "quote-setup": { id: "quote-setup", title: "Quotation setup", description: "The real quotation client setup form with its device-local draft status.", alt: "Studio X OS \u2014 Quotation setup. Fictional sample workspace.", width: 1440, height: 960, light: files("quote-setup", "light", false), dark: files("quote-setup", "dark", false) },
  "quote-editor": { id: "quote-editor", title: "Quotation editor", description: "An existing fictional quotation shown in the current editor.", alt: "Studio X OS \u2014 Quotation editor. Fictional sample workspace.", width: 1440, height: 960, light: files("quote-editor", "light", false), dark: files("quote-editor", "dark", false) },
  "invoices": { id: "invoices", title: "Invoices", description: "Fictional issued invoices, balances and statuses.", alt: "Studio X OS \u2014 Invoices. Fictional sample workspace.", width: 1440, height: 960, light: files("invoices", "light", false), dark: files("invoices", "dark", false) },
  "invoice-editor": { id: "invoice-editor", title: "Invoice editor", description: "An existing sample invoice with its current document and settings layout.", alt: "Studio X OS \u2014 Invoice editor. Fictional sample workspace.", width: 1440, height: 960, light: files("invoice-editor", "light", false), dark: files("invoice-editor", "dark", false) },
  "calendar": { id: "calendar", title: "Calendar", description: "The current calendar workspace with fictional studio events.", alt: "Studio X OS \u2014 Calendar. Fictional sample workspace.", width: 1440, height: 960, light: files("calendar", "light", false), dark: files("calendar", "dark", false) },
  "shoot-day": { id: "shoot-day", title: "Shoot day", description: "The actual shoot-day workspace in the isolated sample preview.", alt: "Studio X OS \u2014 Shoot day. Fictional sample workspace.", width: 1440, height: 960, light: files("shoot-day", "light", false), dark: files("shoot-day", "dark", false) },
  "client-smart-link": CLIENT_SMART_LINK_SCREENSHOT,
  "team": { id: "team", title: "Team", description: "Fictional workspace members and their assigned access roles.", alt: "Studio X OS \u2014 Team. Fictional sample workspace.", width: 1440, height: 960, mobileWidth: 390, mobileHeight: 844, light: files("team", "light", true), dark: files("team", "dark", true) },
  "settings": { id: "settings", title: "Settings", description: "The actual studio settings workspace in the isolated preview.", alt: "Studio X OS \u2014 Settings. Fictional sample workspace.", width: 1440, height: 960, mobileWidth: 390, mobileHeight: 844, light: files("settings", "light", true), dark: files("settings", "dark", true) },
  "integrations": { id: "integrations", title: "Integrations and assistants", description: "Integration setup and assistant tools shown with their honest unconnected preview states.", alt: "Studio X OS \u2014 Integrations and assistants. Fictional sample workspace.", width: 1440, height: 960, light: files("integrations", "light", false), dark: files("integrations", "dark", false) },
  "client-support": { id: "client-support", title: "Client support", description: "A fictional client support conversation; no message is sent.", alt: "Studio X OS \u2014 Client support. Fictional sample workspace.", width: 1440, height: 960, light: files("client-support", "light", false), dark: files("client-support", "dark", false) },
  "email": { id: "email", title: "Email", description: "The email workspace showing its actual setup or connection state.", alt: "Studio X OS \u2014 Email. Fictional sample workspace.", width: 1440, height: 960, light: files("email", "light", false), dark: files("email", "dark", false) },
  "whatsapp": { id: "whatsapp", title: "WhatsApp", description: "The WhatsApp workspace showing its actual setup or connection state.", alt: "Studio X OS \u2014 WhatsApp. Fictional sample workspace.", width: 1440, height: 960, light: files("whatsapp", "light", false), dark: files("whatsapp", "dark", false) },
  "backups": { id: "backups", title: "Backups", description: "The actual backup settings view; no backup operation is performed.", alt: "Studio X OS \u2014 Backups. Fictional sample workspace.", width: 1440, height: 960, light: files("backups", "light", false), dark: files("backups", "dark", false) },
  "offline-drafts": { id: "offline-drafts", title: "Offline drafts", description: "The local draft workspace with its honest sample-session state.", alt: "Studio X OS \u2014 Offline drafts. Fictional sample workspace.", width: 1440, height: 960, light: files("offline-drafts", "light", false), dark: files("offline-drafts", "dark", false) },
  "activity": { id: "activity", title: "Activity log", description: "The actual activity-log view available in the isolated sample workspace.", alt: "Studio X OS \u2014 Activity log. Fictional sample workspace.", width: 1440, height: 960, light: files("activity", "light", false), dark: files("activity", "dark", false) },
};
