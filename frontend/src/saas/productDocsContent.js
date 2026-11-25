// Source-grounded Studio X OS website guides. Business actions remain subject to workspace permissions and readiness.
// Reviewed source: Contacts/ContactWorkflowUI, CRM/StudioLeadForm, ProjectOperations, Quotations, InvoiceWorkspace, Calendar/EventForm, PostProduction, Finance, SettingsEditor/WorkspacePreferences, UserManagement, ProjectSupport, GmailInbox, WabbWorkspace, AssistantConnections, WorkspaceBackupPanel, OfflineDrafts and ActivityLog.
export const DOC_CATEGORIES = [
  {
    "id": "start",
    "title": "Start here"
  },
  {
    "id": "clients",
    "title": "Clients & projects"
  },
  {
    "id": "documents",
    "title": "Quotes, invoices & payments"
  },
  {
    "id": "operations",
    "title": "Production & scheduling"
  },
  {
    "id": "studio",
    "title": "Studio & team"
  },
  {
    "id": "communication",
    "title": "Communication & connections"
  },
  {
    "id": "recovery",
    "title": "Recovery & troubleshooting"
  },
  {
    "id": "client",
    "title": "For your clients"
  }
];

export const DOC_GUIDES = [
  {
    "slug": "getting-started",
    "title": "Start your studio workspace",
    "summary": "A practical first route through studio setup, your first client and the connected enquiry-to-delivery workflow.",
    "category": "start",
    "sections": [
      {
        "id": "orient",
        "title": "Find your working area",
        "paragraphs": [
          "Studio X OS keeps client work connected across enquiries, projects, documents, schedules and delivery. The navigation you see depends on your account’s modules. A missing area can be an access restriction rather than an empty studio."
        ],
        "steps": [
          {
            "title": "Pick up the next job",
            "body": "On Today, open the first item in Up next to go straight to its record. If your role has a limited workspace, Where to start takes you to an area assigned to you."
          },
          {
            "title": "Start something new",
            "body": "Open New in the workspace header and choose what to create. The menu lists the actions available to your account."
          },
          {
            "title": "Check your account",
            "body": "Ask the owner to confirm your workspace and available modules if expected records or actions are missing."
          }
        ],
        "screenshot": {
          "id": "overview",
          "caption": "Notice the daily workspace and the navigation available to your account.",
          "alt": "Overview with daily cards and studio navigation."
        },
        "tips": [
          "Sample records demonstrate the product; preview controls may deliberately prevent saving."
        ]
      },
      {
        "id": "first-workflow",
        "title": "Complete one connected workflow",
        "paragraphs": [
          "Begin with accurate studio information and one real client rather than importing an entire working process at once. Keep the same client and project linked as you prepare documents; this makes later payment and delivery updates easier to understand."
        ],
        "steps": [
          {
            "title": "Set the studio basics",
            "body": "Review Settings for the studio name, document defaults and payment instructions before preparing a client document."
          },
          {
            "title": "Add the client and project",
            "body": "Create a contact, record the enquiry when relevant, then create or open the linked project."
          },
          {
            "title": "Prepare and review",
            "body": "Save a quotation, review its client link, and issue an invoice only after checking the draft and payment schedule."
          }
        ],
        "screenshot": {
          "id": "contacts",
          "caption": "Start from the correct client record before preparing connected project work.",
          "alt": "Contacts register with client records and New contact action."
        },
        "tips": []
      }
    ],
    "related": [
      "studio-settings",
      "contacts",
      "quotations"
    ]
  },
  {
    "slug": "overview-appearance",
    "title": "Make Overview work for you",
    "summary": "Choose Today or Insights, arrange useful cards and set a comfortable appearance without changing studio records.",
    "category": "start",
    "sections": [
      {
        "id": "choose-view",
        "title": "Choose the right view",
        "paragraphs": [
          "Today shows your work status, studio activity, schedule and next tasks. Insights brings together trends, enquiries and financial summaries. Your saved layout determines which cards appear."
        ],
        "steps": [
          {
            "title": "Choose Today or Insights",
            "body": "At the top of Overview, open View options and choose View Insights or View Today."
          },
          {
            "title": "Choose your cards",
            "body": "Open View options and select Customize overview to arrange or hide cards."
          },
          {
            "title": "Recover a hidden layout",
            "body": "Use Choose cards, View Insights or Reset to default when those recovery actions appear."
          }
        ],
        "screenshot": {
          "id": "overview",
          "caption": "Compare Today and Insights before resetting a layout you intentionally customized.",
          "alt": "Today's Overview with the View options button, work status and studio schedule."
        },
        "tips": []
      },
      {
        "id": "appearance",
        "title": "Adjust reading and motion",
        "paragraphs": [
          "Personal appearance controls help you work comfortably in daylight and dark environments. They do not recolor a client’s financial paper or edit document totals. The welcome film and client light effects have their own pause controls."
        ],
        "steps": [
          {
            "title": "Switch appearance",
            "body": "Use the theme control, or the available appearance preference, to select a comfortable mode."
          },
          {
            "title": "Set personal preferences",
            "body": "In Settings, review Reduce motion, Text size, Bottom navigation, Start page and Overview opens in."
          },
          {
            "title": "Pause the welcome film",
            "body": "Use its Pause fluid motion control when you prefer a still card; reduced-motion preferences also retain a still view."
          }
        ],
        "screenshot": {
          "id": "settings",
          "caption": "Personal preferences are separate from studio identity and billing defaults.",
          "alt": "Settings with appearance and workspace preferences."
        },
        "tips": []
      }
    ],
    "related": [
      "getting-started",
      "studio-settings",
      "troubleshooting"
    ]
  },
  {
    "slug": "contacts",
    "title": "Create and maintain client contacts",
    "summary": "Keep identity and communication details accurate, then create the client’s project, document or session from the profile.",
    "category": "clients",
    "sections": [
      {
        "id": "create-contact",
        "title": "Add a contact",
        "paragraphs": [
          "Contacts stores people and their contact details. Event dates and shoot schedules are separate records. Avoid using a new contact to duplicate a person who already has projects or documents in the studio."
        ],
        "steps": [
          {
            "title": "Check existing records",
            "body": "Search Contacts first and open a likely match to verify the email and existing work."
          },
          {
            "title": "Select New contact",
            "body": "In Add contact, enter First name and Email, then choose Contact type: Client, Lead or Other."
          },
          {
            "title": "Complete useful details",
            "body": "Add Last name, Company and Phone as needed; expand Additional info for address, country and notes, then save."
          }
        ],
        "screenshot": {
          "id": "contact-form",
          "caption": "The contact form records identity and address details, not a list of events.",
          "alt": "Add contact form with name, email and additional information."
        },
        "tips": []
      },
      {
        "id": "maintain-profile",
        "title": "Work from the client profile",
        "paragraphs": [
          "The profile gathers Projects, Recent conversations, Documents, Payments and Sessions. Use it to understand what already exists before adding another record. The available Create new choices depend on your permissions and configured capabilities."
        ],
        "steps": [
          {
            "title": "Review the profile",
            "body": "Open the contact and check the linked work and communication details before contacting the client."
          },
          {
            "title": "Create the next record",
            "body": "Use Create new and an available Project, Quote, Invoice or Session action for the task you intend."
          },
          {
            "title": "Maintain the record",
            "body": "Use Contact actions for Edit contact or Archive contact; use Restore contact when an archived record should return."
          }
        ],
        "screenshot": {
          "id": "contact-detail",
          "caption": "Review existing projects and documents before creating another item.",
          "alt": "Contact profile with linked projects and records."
        },
        "tips": []
      }
    ],
    "related": [
      "calendar-shoot-day",
      "projects-crew",
      "enquiries"
    ]
  },
  {
    "slug": "enquiries",
    "title": "Manage enquiries and follow-ups",
    "summary": "Record the initial request, set a useful next follow-up and move forward without breaking the client’s linked records.",
    "category": "clients",
    "sections": [
      {
        "id": "capture",
        "title": "Capture the enquiry",
        "paragraphs": [
          "An enquiry keeps the initial conversation and booking context together. Use the actual stage that reflects your relationship with the client. A future follow-up date is a reminder to act, not evidence that a booking is confirmed."
        ],
        "steps": [
          {
            "title": "Choose New enquiry",
            "body": "Enter Full name, Email address and Phone number, then choose Enquiry stage."
          },
          {
            "title": "Record the event request",
            "body": "Complete Event type, Event date, Event time, Venue / location and the Creative brief with the information you know."
          },
          {
            "title": "Set the next action",
            "body": "Choose Next follow-up where appropriate and select Create enquiry; use Save changes when updating an existing request."
          }
        ],
        "screenshot": {
          "id": "enquiries",
          "caption": "Review enquiry stages, follow-up context and linked next steps from the register.",
          "alt": "Enquiries workspace with client requests and follow-up information."
        },
        "tips": []
      },
      {
        "id": "follow-through",
        "title": "Follow through on the same record",
        "paragraphs": [
          "Open the enquiry before a call or meeting and review its linked project or quotation. Sessions are scheduled through Calendar. Quotation created/shared/accepted history is shown with the quotation; the contact profile is not a universal History tab."
        ],
        "steps": [
          {
            "title": "Save a follow-up",
            "body": "In enquiry details, set Next follow-up date and choose Save follow-up; use Mark complete after handling it."
          },
          {
            "title": "Continue the workflow",
            "body": "Use Create project or Open project, then Create quotation or View quotation to retain the existing relationship."
          },
          {
            "title": "Keep records connected",
            "body": "Schedule a meeting as a linked session and return to the original enquiry when updating its stage or notes."
          }
        ],
        "screenshot": {
          "id": "project-detail",
          "caption": "Linked project and document actions preserve the enquiry’s working context.",
          "alt": "Connected project workspace and documents."
        },
        "tips": []
      }
    ],
    "related": [
      "calendar-shoot-day",
      "projects-crew",
      "quotations"
    ]
  },
  {
    "slug": "projects-crew",
    "title": "Run a project and assign its crew",
    "summary": "Bring the client, dates, documents, crew and delivery checklist together in the project workspace.",
    "category": "clients",
    "sections": [
      {
        "id": "project-setup",
        "title": "Create or review the project",
        "paragraphs": [
          "A project is the working home for the engagement. Start it from the linked enquiry or contact when possible. Additional clients connect other people to the same work; they do not create additional shoots or staff accounts."
        ],
        "steps": [
          {
            "title": "Create the project",
            "body": "Choose the available Project action and complete Primary client, Project name, Project type and Status."
          },
          {
            "title": "Add the engagement details",
            "body": "Set Project date, End date, Location, Description and any Additional clients, then Create project."
          },
          {
            "title": "Review readiness",
            "body": "Open the project and check Overview, Documents and the available Payments, Crew and Delivery tabs."
          }
        ],
        "screenshot": {
          "id": "projects",
          "caption": "Project names and client links help distinguish separate engagements.",
          "alt": "Projects register with linked client work."
        },
        "tips": []
      },
      {
        "id": "coordinate",
        "title": "Coordinate people and next steps",
        "paragraphs": [
          "Crew assignments are operational project records. Team & access controls who can sign in and which modules they may use. Assigning someone to a project is not the same as giving them administrator access."
        ],
        "steps": [
          {
            "title": "Assign the crew",
            "body": "Open Crew, choose a person under Assign crew and select Assign; check the displayed contact details."
          },
          {
            "title": "Review the checklist",
            "body": "In Delivery, add a New task with Deliverable and Due date, or open Advanced task options & templates."
          },
          {
            "title": "Schedule the work",
            "body": "Use Schedule a session and Open shoot day to connect the project’s dates with its assigned people."
          }
        ],
        "screenshot": {
          "id": "project-detail",
          "caption": "The project tabs keep crew, documents and delivery within the same engagement.",
          "alt": "Project detail showing operational tabs and readiness."
        },
        "tips": []
      }
    ],
    "related": [
      "post-production-delivery",
      "calendar-shoot-day",
      "team-access"
    ]
  },
  {
    "slug": "quotations",
    "title": "Prepare and share a quotation",
    "summary": "Link the right client and project, review the document, then share a client link with clear acceptance expectations.",
    "category": "documents",
    "sections": [
      {
        "id": "templates",
        "title": "Reuse a photography package",
        "steps": [
          { "title": "Find a package", "body": "Search Templates by name or service. Choose New Template if you need a different package." },
          { "title": "Set the starting price and terms", "body": "Save the coverage, quantities, prices and terms you usually offer together." },
          { "title": "Use it for one booking", "body": "Choose Use template, select the client and review the resulting quote for their events." }
        ]
      },
      {
        "id": "setup",
        "title": "Start with the correct relationship",
        "paragraphs": [
          "Create the quotation from the enquiry or project when that context already exists. Client and Project choices help keep documents attached to the right engagement. A quotation remains a proposal; sharing it does not confirm that a payment was received."
        ],
        "steps": [
          {
            "title": "Set up the quotation",
            "body": "Choose the client in the quotation setup and select the matching Project when available."
          },
          {
            "title": "Check the project link",
            "body": "Use Link to project where needed; project choices are limited to the selected client’s relevant work."
          },
          {
            "title": "Continue to the editor",
            "body": "Review the setup before entering the service items, prices and terms in the quotation editor."
          }
        ],
        "screenshot": {
          "id": "quote-setup",
          "caption": "Check the selected client and linked project before editing prices.",
          "alt": "Quotation setup with client and project choices."
        },
        "tips": []
      },
      {
        "id": "review-share",
        "title": "Review, save and share",
        "paragraphs": [
          "Check line items, quantity, price, taxes, discounts, branding and client details as a complete document. Read the client view before sending. The same Smart Link can later show issued invoice details and published progress according to its visibility settings."
        ],
        "steps": [
          {
            "title": "Save the studio copy",
            "body": "Choose Save to studio and make sure the saved document contains the version you intend to share."
          },
          {
            "title": "Share the client view",
            "body": "Use Share client link, Share via WhatsApp or Open smart client link as available; check the recipient yourself."
          },
          {
            "title": "Follow the acceptance",
            "body": "Review created, shared and accepted history. Any Create draft invoice action still requires a separate studio review and issue."
          }
        ],
        "screenshot": {
          "id": "quote-editor",
          "caption": "Review both the quotation content and its sharing controls before sending the link.",
          "alt": "Quotation editor with items, settings and sharing actions."
        },
        "tips": [
          "Owner preview and expired quotations cannot be accepted as a client transaction."
        ]
      }
    ],
    "related": [
      "invoices",
      "client-smart-link",
      "studio-settings"
    ]
  },
  {
    "slug": "invoices",
    "title": "Review a draft and issue an invoice",
    "summary": "Understand the difference between a saved draft and an issued invoice before publishing client payment details.",
    "category": "documents",
    "sections": [
      {
        "id": "draft",
        "title": "Prepare the draft",
        "paragraphs": [
          "An accepted quote can prepare a draft invoice when that option is enabled. Draft means the studio still needs to review it. The client should not be told an invoice or schedule is available merely because the draft exists."
        ],
        "steps": [
          {
            "title": "Open the invoice",
            "body": "Use New invoice or open the draft prepared from the accepted quotation."
          },
          {
            "title": "Check the billing details",
            "body": "Review client, project, invoice number, dates, currency, item descriptions, quantity, price, tax and discount."
          },
          {
            "title": "Review the total and plan",
            "body": "Check the calculated amount and any installment schedule against the agreement before proceeding."
          }
        ],
        "screenshot": {
          "id": "invoice-editor",
          "caption": "The editor separates document details, line items and payment settings.",
          "alt": "Invoice editor with billing fields and financial items."
        },
        "tips": []
      },
      {
        "id": "issue",
        "title": "Approve the version the client should see",
        "paragraphs": [
          "Approve & issue publishes the reviewed invoice and payment information on the existing project link. It does not automatically email the client. Issued is a document state; payment status is a separate record of receipts and balances."
        ],
        "steps": [
          {
            "title": "Resolve review questions",
            "body": "Confirm the invoice’s client, due dates and bank instructions with the responsible studio person."
          },
          {
            "title": "Choose Approve & issue",
            "body": "Use the explicit issue action after review; do not treat simply saving a draft as publication."
          },
          {
            "title": "Inspect and share",
            "body": "Open the client view to verify the issued document, then use the available sharing or configured outgoing-mail action deliberately."
          }
        ],
        "screenshot": {
          "id": "invoices",
          "caption": "Distinguish the document’s issue state from its payment status in the register.",
          "alt": "Invoices register with document and payment states."
        },
        "tips": []
      }
    ],
    "related": [
      "payment-schedules",
      "quotations",
      "finance"
    ]
  },
  {
    "slug": "payment-schedules",
    "title": "Set installments and confirm receipts",
    "summary": "Use the invoice payment plan to communicate amounts and dates, then update receipts only after your studio verifies them.",
    "category": "documents",
    "sections": [
      {
        "id": "plan",
        "title": "Build a readable payment plan",
        "paragraphs": [
          "Use installments divides the invoice into planned payments. Review both amounts and dates, including the final payment that covers the remaining balance. A plan explains when money is due; it is not a payment-processing confirmation."
        ],
        "steps": [
          {
            "title": "Enable the schedule",
            "body": "In the invoice editor, turn on Use installments when the agreement requires more than one payment."
          },
          {
            "title": "Review each installment",
            "body": "Set its amount or percentage and due date using the available controls; check the remaining final balance."
          },
          {
            "title": "Check the client version",
            "body": "After studio review and issue, open the Smart Link and verify the dates and instructions the client will see."
          }
        ],
        "screenshot": {
          "id": "invoice-editor",
          "caption": "The invoice editor is shown at the top of the document; open the payment-plan controls to review installments.",
          "alt": "Top of the invoice editor with document details and settings."
        },
        "tips": []
      },
      {
        "id": "receipts",
        "title": "Record verified receipts separately",
        "paragraphs": [
          "Make payment shows the studio’s saved transfer instructions and can open a client’s payment app. The studio still confirms receipt. Client invoices pay your studio; the Studio X OS workspace subscription, where available, is a separate service charge."
        ],
        "steps": [
          {
            "title": "Check the actual receipt",
            "body": "Verify the transfer against your bank or payment records before updating the invoice."
          },
          {
            "title": "Update the invoice record",
            "body": "Set Payment status and Payments received (₹) accurately, then save using the available invoice action."
          },
          {
            "title": "Review the remaining balance",
            "body": "Open Finance and the client link to check the resulting balance and next payment date."
          }
        ],
        "screenshot": {
          "id": "finance",
          "caption": "Finance keeps invoice dues and recorded booking receipts in distinct views.",
          "alt": "Finance dashboard showing invoice balances and due payments."
        },
        "tips": [
          "A submitted payment reference or opened payment app is not automatic bank verification."
        ]
      }
    ],
    "related": [
      "invoices",
      "finance",
      "studio-settings"
    ]
  },
  {
    "slug": "client-smart-link",
    "title": "Share and manage the client Smart Link",
    "summary": "Review what the client can see, then share the existing project link without confusing document preparation with publication.",
    "category": "documents",
    "sections": [
      {
        "id": "prepare",
        "title": "Prepare the client view",
        "paragraphs": [
          "The Smart Link follows the saved client visibility settings. It can bring the quotation, issued invoice, payment schedule and published production information together, while keeping internal work separate. A link does not automatically make every studio record available. Sharing actions require the relevant account access."
        ],
        "steps": [
          {
            "title": "Open the linked project",
            "body": "Review its Documents and project readiness, then use Client smart link when the saved quotation is available."
          },
          {
            "title": "Prepare missing context",
            "body": "If Prepare client link appears, open Documents and prepare the linked quotation before continuing."
          },
          {
            "title": "Inspect Open link",
            "body": "Review the client name, quotation version and visible sections from the actual client view before announcing the link."
          }
        ],
        "screenshot": {
          "id": "quotations",
          "caption": "Prepare the saved quotation and client relationship before sharing its project link.",
          "alt": "Quotations register with saved client proposals."
        },
        "tips": []
      },
      {
        "id": "share",
        "title": "Share intentionally and keep the view accurate",
        "paragraphs": [
          "Use the same client project context as work progresses. Review visibility defaults and any document-specific choices before sharing, especially crew, progress, deliverable links, invoice/payment information and support. The destination may contain private financial and project details."
        ],
        "steps": [
          {
            "title": "Copy the intended link",
            "body": "In Share client smart link choose Copy link, or use Share client link from the quotation workflow."
          },
          {
            "title": "Choose the right recipient",
            "body": "Send the link deliberately through your chosen channel. Share via WhatsApp does not prove delivery or bank receipt."
          },
          {
            "title": "Check after important changes",
            "body": "Reopen the client view after issue or a published update, and confirm any external delivery folder grants the intended client access."
          }
        ],
        "screenshot": {
          "id": "client-smart-link",
          "caption": "Inspect the client’s actual view, including pending and studio-managed sections.",
          "alt": "Client Smart Link showing document availability and project progress."
        },
        "tips": []
      }
    ],
    "related": [
      "client-guide",
      "quotations",
      "payment-schedules"
    ]
  },
  {
    "slug": "client-guide",
    "title": "Client guide: use your project Smart Link",
    "summary": "Review your quotation, issued invoice, payments and creative progress from the private link supplied by your studio.",
    "category": "client",
    "sections": [
      {
        "id": "review-project",
        "title": "Review the project and documents",
        "paragraphs": [
          "Your project page brings the available Quotation, Invoice, Payments and Post-production sections together. A pending or studio-managed section is not a failed payment or missing file. Availability depends on the studio’s published information and your project stage."
        ],
        "steps": [
          {
            "title": "Open a summary tile",
            "body": "Choose the section you need; the page opens its matching details and shows the current state."
          },
          {
            "title": "Review the quotation",
            "body": "Read the scope and terms. If acceptance is available, use Accept Quote, enter the requested name and give the displayed consent."
          },
          {
            "title": "Read the issued invoice",
            "body": "Open Invoice and View full invoice when available; an accepted quotation can still be waiting for studio invoice review."
          }
        ],
        "screenshot": {
          "id": "client-smart-link",
          "caption": "The four colored summaries lead to the matching project details.",
          "alt": "Client Smart Link with quotation, invoice, payments and production summaries."
        },
        "tips": [
          "Keep this project link private and share it only with people who should see your project details."
        ]
      },
      {
        "id": "payments-progress",
        "title": "Handle payments, updates and questions",
        "paragraphs": [
          "Payments are updated after the studio confirms receipt. Post-production and delivery show the updates the studio has published, not every internal task. Crew and support details appear only when shared. Theme and effects choices change your viewing comfort, not your project records."
        ],
        "steps": [
          {
            "title": "Follow payment instructions",
            "body": "Choose Make payment for the saved UPI or bank details, complete the transfer separately and follow the studio’s confirmation instructions."
          },
          {
            "title": "Check creative updates",
            "body": "Open Post-production and available delivery links; contact the studio if a linked folder does not grant you access."
          },
          {
            "title": "Ask or adjust the view",
            "body": "Use support chat for project questions. Switch Daylight/Dark or Pause effects; reduced-motion devices show Effects reduced."
          }
        ],
        "screenshot": {
          "id": "client-smart-link",
          "caption": "Read the state labels and payment dates as well as the card colors.",
          "alt": "Client project details with support and appearance controls."
        },
        "tips": []
      }
    ],
    "related": [
      "quotations",
      "payment-schedules",
      "post-production-delivery"
    ]
  },
  {
    "slug": "post-production-delivery",
    "title": "Plan production and publish delivery updates",
    "summary": "Turn editing and review work into assigned tasks, then publish clear client updates only when they are ready to share.",
    "category": "operations",
    "sections": [
      {
        "id": "templates",
        "title": "Reuse a delivery checklist",
        "steps": [
          { "title": "Choose the type of work", "body": "In Settings, open Production templates and select or add the checklist your team needs." },
          { "title": "Define the deliverables", "body": "Set the task names, categories, timing and client visibility. Save your settings." },
          { "title": "Apply it to a project", "body": "Open Tasks, choose Apply template and review the selected project and template before adding the tasks." }
        ]
      },
      {
        "id": "tasks",
        "title": "Create an actionable task",
        "paragraphs": [
          "Internal task titles help your team work; client-facing wording should explain progress without internal shorthand. A task’s completion and its production stage are distinct controls, so review both when work moves forward."
        ],
        "steps": [
          {
            "title": "Choose Add task",
            "body": "Enter Internal task title and Due date, then select the linked Project rather than leaving client work as a Studio task."
          },
          {
            "title": "Choose the deliverable and owner",
            "body": "Set Deliverable, Production stage and Assigned crew member when that access is available."
          },
          {
            "title": "Save and track",
            "body": "Choose Add task or Save changes, then use the status, project and search filters to find the work again."
          }
        ],
        "screenshot": {
          "id": "production",
          "caption": "Tasks combine a project, deadline, stage and assigned crew member.",
          "alt": "Post production workspace with task filters and status records."
        },
        "tips": []
      },
      {
        "id": "publish",
        "title": "Publish a considered client update",
        "paragraphs": [
          "Publish update to client shares the deliverable’s stage, assigned crew and update on the project link after invoice issue. The delivery or review link appears at the appropriate ready, uploaded, delivered or selection stage. Internal notes should remain internal."
        ],
        "steps": [
          {
            "title": "Enable the client update",
            "body": "In the task editor, choose Publish update to client when you are ready to share that task."
          },
          {
            "title": "Write for the client",
            "body": "Complete Client-facing title, Client update and the Delivery or review link if relevant."
          },
          {
            "title": "Verify access and visibility",
            "body": "Check the destination folder’s client access and inspect the Smart Link before announcing that files are ready."
          }
        ],
        "screenshot": {
          "id": "project-detail",
          "caption": "The project is shown on Overview; choose Delivery to review its checklist and client-visible tasks.",
          "alt": "Project workspace with the Overview tab selected."
        },
        "tips": [
          "Marking a task complete does not upload files or grant access to an external folder."
        ]
      }
    ],
    "related": [
      "projects-crew",
      "calendar-shoot-day",
      "client-guide"
    ]
  },
  {
    "slug": "calendar-shoot-day",
    "title": "Schedule events and prepare for shoot day",
    "summary": "Plan linked sessions in the studio calendar, then use Shoot day for venue, crew and checklist context on location.",
    "category": "operations",
    "sections": [
      {
        "id": "calendar",
        "title": "Create and review an event",
        "paragraphs": [
          "Studio calendar holds shoots, consultations and other scheduled events. To sync with Google, open Calendar as the studio owner, choose Connect Google and approve calendar access for a Google account dedicated to that studio. A primary calendar can connect to one studio at a time. Events in its primary calendar become visible to your team. Use Disconnect to stop future sync. Check the studio timezone when scheduling.",
          "For several shoot dates, keep the overall Project date and End date on the project, then create a calendar event for each distinct session. A contact is a person, and the enquiry form captures one initial event request; Additional clients means other people, not extra events. Enter and verify venue text manually."
        ],
        "steps": [
          {
            "title": "Choose Schedule event",
            "body": "Enter Event title, Occasion and Linked enquiry / project, or leave it as a Studio event when appropriate."
          },
          {
            "title": "Set the date and venue",
            "body": "Use All-day event with First day and Last day, or timezone-labelled Starts and Ends; add Venue / location and Shoot notes."
          },
          {
            "title": "Assign and save",
            "body": "Choose Assigned crew and Save event. Use Week to compare sessions across seven days, Month for the monthly grid, or Agenda for the event list. Search and the Crew filter narrow each view."
          }
        ],
        "screenshot": {
          "id": "calendar",
          "caption": "Check the linked record and studio timezone before saving an event.",
          "alt": "Studio calendar with events, filters and connection status."
        },
        "tips": []
      },
      {
        "id": "shoot-day",
        "title": "Use the on-location view",
        "paragraphs": [
          "Shoot day collects the selected day’s events with project context. It can show venue, client contact links, assigned crew and the project checklist according to your modules. It does not invent missing contact details when a record link needs review."
        ],
        "steps": [
          {
            "title": "Choose the date",
            "body": "Open Shoot day, select Date or Today, and use previous/next controls to inspect another day."
          },
          {
            "title": "Check the event context",
            "body": "Use Event details, Directions, Call client, Email client or Open project when the corresponding details are present."
          },
          {
            "title": "Keep the checklist current",
            "body": "Complete the relevant project tasks and use Refresh if the schedule or related project data has changed."
          }
        ],
        "screenshot": {
          "id": "shoot-day",
          "caption": "Confirm venue and assigned crew before leaving for the event.",
          "alt": "Shoot day with schedule, contact actions, crew and checklist."
        },
        "tips": []
      }
    ],
    "related": [
      "calendar-shoot-day",
      "projects-crew",
      "post-production-delivery"
    ]
  },
  {
    "slug": "finance",
    "title": "Read finances without counting money twice",
    "summary": "Separate booking receipts, invoice dues and cash-ledger entries so the studio can understand what each figure represents.",
    "category": "operations",
    "sections": [
      {
        "id": "views",
        "title": "Choose the correct financial view",
        "paragraphs": [
          "Received on bookings reflects CRM payment records. Booking balances reflects confirmed enquiry balances. Paid expenses comes from the cash ledger. Due now focuses on issued INR invoices due today or overdue. These are related views, not interchangeable totals."
        ],
        "steps": [
          {
            "title": "Choose a register",
            "body": "Switch between Booking payments, Due now, Invoices and Cash ledger as available to your account."
          },
          {
            "title": "Read the explanation",
            "body": "Open How balances work before adding figures together or comparing separate sources."
          },
          {
            "title": "Open the underlying record",
            "body": "Use the invoice or booking action to inspect the client, status and amount that contributes to the summary."
          }
        ],
        "screenshot": {
          "id": "finance",
          "caption": "Read each metric’s note and register before interpreting its total.",
          "alt": "Finance metrics with booking, due, invoice and ledger views."
        },
        "tips": [
          "An invoice balance and a booking balance can describe the same engagement; do not count both as separate income."
        ]
      },
      {
        "id": "transactions",
        "title": "Record a ledger transaction",
        "paragraphs": [
          "The ledger reflects what the studio enters there. It is not an automatic bank feed. Keeping a consistent category and description makes the register useful for later review without changing the meaning of invoice receipt records."
        ],
        "steps": [
          {
            "title": "Choose Record transaction",
            "body": "Select Expense or Income and enter Description, Amount (₹), Category and Date."
          },
          {
            "title": "Use the correct status",
            "body": "Choose Paid or Pending for an expense, or Received or Pending for income; link an expense to a Project when useful."
          },
          {
            "title": "Review after saving",
            "body": "Check the register and any receipt you attached. Correct mistakes in the relevant record rather than adding a balancing duplicate."
          }
        ],
        "screenshot": {
          "id": "finance",
          "caption": "A transaction records an amount, date, category and actual payment state.",
          "alt": "Finance transaction entry and ledger records."
        },
        "tips": []
      }
    ],
    "related": [
      "payment-schedules",
      "invoices",
      "troubleshooting"
    ]
  },
  {
    "slug": "team-access",
    "title": "Give your team the access they need",
    "summary": "Distinguish account access, workspace invitations and operational crew assignments before adding or changing a team member.",
    "category": "studio",
    "sections": [
      {
        "id": "workspace",
        "title": "Check your workspace and seats",
        "steps": [
          { "title": "Check the studio", "body": "Review the workspace name, plan and seats in use on Overview." },
          { "title": "Manage people or the plan", "body": "Use the team tab for members and pending invites. Use Subscription for the current plan and available capacity." }
        ]
      },
      {
        "id": "plan",
        "title": "Review your subscription",
        "steps": [
          { "title": "Check the current plan", "body": "Review its status, seat usage and trial end date if one is shown." },
          { "title": "Compare capacity", "body": "Compare the available plans against the people who need access. The studio owner manages plan changes when billing is available." }
        ]
      },
      {
        "id": "accounts",
        "title": "Invite a member to your commercial workspace",
        "paragraphs": [
          "Team & invitations lists workspace members, roles and pending invitations. The owner can use Invite a member when seats and live configuration allow it; preview mode blocks changes."
        ],
        "steps": [
          {
            "title": "Open Team & invitations",
            "body": "Open the studio’s team area and review the current members and available seats."
          },
          {
            "title": "Choose Invite a member",
            "body": "Enter Email address, choose Workspace role: Team member or Administrator, then select Create invitation."
          },
          {
            "title": "Share the invitation link",
            "body": "Share the private link deliberately with the intended person."
          }
        ],
        "screenshot": {
          "id": "team",
          "caption": "Team & invitations shows members, roles and pending invitations; Invite a member starts the owner’s invitation flow.",
          "alt": "Commercial Team & invitations with workspace members and an Invite a member action."
        },
        "tips": [
          "Creating an invitation does not automatically send an email."
        ]
      },
      {
        "id": "invitations",
        "title": "Use alternate account controls only when displayed",
        "paragraphs": [
          "Use the alternate Team & access form only if that screen is actually displayed. It can provide Add team member, sign-in passwords and Workspace modules. Crew assignments remain a separate project workflow."
        ],
        "steps": [
          {
            "title": "Follow the displayed account form",
            "body": "If Add team member is shown, enter the requested name, email and sign-in password, then choose Workspace modules."
          },
          {
            "title": "Review permissions",
            "body": "Grant only the needed modules. Managers cannot edit their own access or the owner; changing a password signs the member out."
          },
          {
            "title": "Remove access carefully",
            "body": "Review active responsibilities before removing access. Business records remain, and project crew assignments are managed separately."
          }
        ],
        "screenshot": {
          "id": "team",
          "caption": "This image shows the commercial invitation route; password and module controls belong only to an alternate account screen when displayed.",
          "alt": "Commercial invitation screen; alternate password and module controls are not pictured."
        },
        "tips": []
      }
    ],
    "related": [
      "projects-crew",
      "studio-settings",
      "troubleshooting"
    ]
  },
  {
    "slug": "studio-settings",
    "title": "Set studio branding, documents and payment defaults",
    "summary": "Prepare accurate studio identity and new-document defaults, then save only the changes you intend to publish.",
    "category": "studio",
    "sections": [
      {
        "id": "automation",
        "title": "Choose what happens after sharing a document",
        "steps": [
          { "title": "Choose how to handle acceptance", "body": "In Reminders & alerts, choose whether an accepted quote creates a draft invoice. Your studio reviews and issues the draft." },
          { "title": "Set the reminder timing", "body": "Choose quotation reminder days after sharing and payment reminder days for outstanding invoices. Email delivery requires a configured studio mail service." },
          { "title": "Save your defaults", "body": "Save changes, then check the settings on your next quote or invoice. Existing documents keep their own settings." }
        ]
      },
      {
        "id": "identity-documents",
        "title": "Review identity and document defaults",
        "paragraphs": [
          "Brand & documents contains studio identity and document appearance. Defaults apply to new documents; an existing quotation or invoice can retain its own branding. A contact link or social number is not an inbox connection."
        ],
        "steps": [
          {
            "title": "Find the setting",
            "body": "Use Find a setting or open Brand & documents, then check Studio name, legal/contact details and Studio address."
          },
          {
            "title": "Set document appearance",
            "body": "Review Document logo URL, Default cover image URL, Document accent colour and Modern, Classic or Editorial typography."
          },
          {
            "title": "Save deliberately",
            "body": "Use Save all changes for studio edits, or Revert section or Discard if the proposed changes are not intended."
          }
        ],
        "screenshot": {
          "id": "settings",
          "caption": "Studio changes use a save bar; personal preferences are separate.",
          "alt": "Settings directory with brand and document sections."
        },
        "tips": []
      },
      {
        "id": "billing-visibility",
        "title": "Check payment and visibility defaults",
        "paragraphs": [
          "Billing & payments contains numbering, tax, discount and payment instructions. Acceptance can create a draft invoice, but Studio approval before invoice issue remains required. Client visibility defaults govern newly created Smart Links."
        ],
        "steps": [
          {
            "title": "Review financial defaults",
            "body": "Check prefixes, numbering, due days, tax and discount, then enter Bank transfer details, UPI ID and Payment instructions."
          },
          {
            "title": "Review the default plan",
            "body": "For milestones, check Amount (%) totals 100 and Due in days fits within the invoice’s due date."
          },
          {
            "title": "Review client visibility",
            "body": "Choose which crew, progress, deliverable, invoice/payment and support information new client links may show."
          }
        ],
        "screenshot": {
          "id": "settings",
          "caption": "Check the studio’s bank instructions and issue safeguards before sharing financial documents.",
          "alt": "Settings with billing, payment-plan and client-visibility defaults."
        },
        "tips": []
      }
    ],
    "related": [
      "overview-appearance",
      "payment-schedules",
      "integrations-ai"
    ]
  },
  {
    "slug": "client-support",
    "title": "Reply in the right client support conversation",
    "summary": "Use the project support thread for project questions without confusing it with email or WhatsApp delivery.",
    "category": "communication",
    "sections": [
      {
        "id": "find-thread",
        "title": "Find the existing conversation",
        "paragraphs": [
          "Client support holds conversations associated with client project pages. It is not a generic recipient composer. An empty inbox can mean the client has not started a conversation, and a sample preview cannot be used to send a real reply."
        ],
        "steps": [
          {
            "title": "Open Client support",
            "body": "Use the Communication navigation and search the available conversations for the correct client or document."
          },
          {
            "title": "Read the context",
            "body": "Open the thread and check the name, linked record and recent messages before deciding what to answer."
          },
          {
            "title": "Check the next step",
            "body": "Open the relevant project or document if a payment, schedule or delivery question requires verification."
          }
        ],
        "screenshot": {
          "id": "client-support",
          "caption": "Confirm the linked client and document before replying.",
          "alt": "Client support inbox with a selected project conversation."
        },
        "tips": []
      },
      {
        "id": "reply",
        "title": "Send a clear project reply",
        "paragraphs": [
          "A support reply appears on the client’s project page. It does not also send an email or WhatsApp message. Use the channel that fits the request, and avoid promising a delivery or receipt that the studio has not verified."
        ],
        "steps": [
          {
            "title": "Write Reply to client",
            "body": "Answer the client’s actual question using confirmed dates, figures and available next steps."
          },
          {
            "title": "Review before sending",
            "body": "Check names, links and any financial statement; use the correct document as the source of truth."
          },
          {
            "title": "Choose Send reply",
            "body": "Send once, then inspect the thread. If a save or connection error occurs, verify the thread before repeating the message."
          }
        ],
        "screenshot": {
          "id": "client-support",
          "caption": "Support messages stay attached to their client project conversation.",
          "alt": "Support reply composer and conversation history."
        },
        "tips": []
      }
    ],
    "related": [
      "client-guide",
      "email",
      "whatsapp"
    ]
  },
  {
    "slug": "email",
    "title": "Connect and read Gmail safely",
    "summary": "Understand the read-only studio Email view and keep it separate from outgoing quotation or invoice mail.",
    "category": "communication",
    "sections": [
      {
        "id": "connect",
        "title": "Connect the mailbox when available",
        "paragraphs": [
          "The Email area can show a private administrator Gmail mailbox after authorization. Sample previews cannot access real mail, and unavailable setup is not fixed by repeatedly pressing Connect. Calendar authorization and outgoing document mail are separate connections."
        ],
        "steps": [
          {
            "title": "Open Email",
            "body": "Read the connection or setup state before attempting to access messages."
          },
          {
            "title": "Choose Connect Gmail",
            "body": "When enabled, Continue to Google and authorize the intended account with the required read consent."
          },
          {
            "title": "Verify the account",
            "body": "Return to the Email area and confirm that you are viewing the mailbox you intended."
          }
        ],
        "screenshot": {
          "id": "email",
          "caption": "The connection state should identify the available Gmail mailbox or setup requirement.",
          "alt": "Email workspace with connection state or mailbox view."
        },
        "tips": []
      },
      {
        "id": "read",
        "title": "Read and locate messages",
        "paragraphs": [
          "The mailbox view is read-only. Opening a message does not mark it read or modify Gmail, and fetched messages are not copied into the studio database. Use Gmail itself for mailbox actions that the studio view does not provide."
        ],
        "steps": [
          {
            "title": "Choose a view",
            "body": "Browse Inbox, Sent or All and use Search to narrow the messages you need."
          },
          {
            "title": "Review the message",
            "body": "Use Previous, Next and Refresh email as needed; verify the sender and complete thread context."
          },
          {
            "title": "Continue in Gmail",
            "body": "Choose Open in Gmail for actions outside this read-only view, including normal mailbox management."
          }
        ],
        "screenshot": {
          "id": "email",
          "caption": "Use the mailbox controls for reading, and Open in Gmail for supported external actions.",
          "alt": "Read-only Gmail message list and message detail."
        },
        "tips": [
          "A readable inbox does not establish that outgoing quotation or invoice email is configured."
        ]
      }
    ],
    "related": [
      "client-support",
      "integrations-ai",
      "troubleshooting"
    ]
  },
  {
    "slug": "whatsapp",
    "title": "Use the WhatsApp connection actually available",
    "summary": "Read the provider and readiness state before composing; sending and inbox capabilities differ between supported connection routes.",
    "category": "communication",
    "sections": [
      {
        "id": "identify-route",
        "title": "Identify your provider workflow",
        "paragraphs": [
          "A Wabb connection supports manual individual text or link requests to an existing Wabb contact number. It does not create contacts or synchronize an inbox, history, template library or delivery/read receipts. Other configured provider routes can expose different inbox capabilities."
        ],
        "steps": [
          {
            "title": "Open WhatsApp",
            "body": "Read the provider label, connection status and any setup requirement before using a send control."
          },
          {
            "title": "Check the intended contact",
            "body": "Verify the exact client number and that it already exists where the provider requires it."
          },
          {
            "title": "Read the available controls",
            "body": "Use only the workflow your screen actually offers; sample and demo views cannot send real messages."
          }
        ],
        "screenshot": {
          "id": "whatsapp",
          "caption": "The provider state determines whether this is a manual-send workflow or an available inbox.",
          "alt": "WhatsApp workspace showing provider readiness and messaging controls."
        },
        "tips": []
      },
      {
        "id": "send-review",
        "title": "Review one deliberate message",
        "paragraphs": [
          "For Wabb, confirm permission and the required recent client-message window, then review the individual text or link before sending. Other supported connections may offer approved templates outside the active reply window; that capability is not universal."
        ],
        "steps": [
          {
            "title": "Prepare the message",
            "body": "Choose the correct client and enter clear text or the intended project link, without adding an unsupported delivery promise."
          },
          {
            "title": "Confirm required permission",
            "body": "Complete the displayed permission and timing confirmations before using Send through Wabb or the available provider action."
          },
          {
            "title": "Inspect the result",
            "body": "A submitted request is not proof of delivery or reading. If an attempt is uncertain, check the provider before composing another."
          }
        ],
        "screenshot": {
          "id": "whatsapp",
          "caption": "Review recipient, consent and request result rather than assuming a sent request was delivered.",
          "alt": "WhatsApp message composer with permission and status information."
        },
        "tips": [
          "The product does not automatically resend an uncertain Wabb attempt."
        ]
      }
    ],
    "related": [
      "client-support",
      "quotations",
      "integrations-ai"
    ]
  },
  {
    "slug": "integrations-ai",
    "title": "Check integrations and assistant readiness",
    "summary": "Distinguish configured connections, planned capabilities and reviewed drafts before granting access or promising automated work.",
    "category": "communication",
    "sections": [
      {
        "id": "readiness",
        "title": "Read connection status first",
        "paragraphs": [
          "Provider artwork identifies a service; it does not prove the service is connected. Commercial assistant connections are being prepared and send no studio data through that preview. Gmail, Google Calendar, Drive and outgoing document mail have separate setup and permission requirements."
        ],
        "steps": [
          {
            "title": "Open Integrations",
            "body": "Read each service’s actual status and setup message before attempting a connection or test."
          },
          {
            "title": "Complete available setup",
            "body": "Use an enabled provider connection or Test connection only when your workspace is configured and eligible."
          },
          {
            "title": "Verify the intended account",
            "body": "Confirm the provider identity and permissions, then return to the actual workflow to check its available actions."
          }
        ],
        "screenshot": {
          "id": "integrations",
          "caption": "Look for readiness and setup labels beside the original service marks.",
          "alt": "Integrations with provider cards, connection states and assistant area."
        },
        "tips": [
          "A ChatGPT sign-in does not connect an OpenAI API account; OpenClaw is connection-only rather than drafting."
        ]
      },
      {
        "id": "drafts",
        "title": "Review assistant drafts when enabled",
        "paragraphs": [
          "In an eligible configured drafting environment, the assistant uses the text entered into the request. It does not automatically attach studio records, send the result or change quotations. Do not treat a disabled commercial preview as an active assistant connection."
        ],
        "steps": [
          {
            "title": "Choose the draft task",
            "body": "When available, select Assistant, Write a and Tone, then explain What should it include?"
          },
          {
            "title": "Give deliberate consent",
            "body": "Review the entered text and the consent checkbox before selecting Generate draft."
          },
          {
            "title": "Review and use the result",
            "body": "Check names, dates, prices and commitments, edit the result, then Copy draft or Clear draft as needed."
          }
        ],
        "screenshot": {
          "id": "integrations",
          "caption": "The consent and draft controls are separate from a real message-send action.",
          "alt": "Assistant area with task, tone, context and consent controls."
        },
        "tips": []
      }
    ],
    "related": [
      "email",
      "whatsapp",
      "studio-settings"
    ]
  },
  {
    "slug": "backups",
    "title": "Create a backup and understand recovery limits",
    "summary": "Prepare encrypted workspace backups carefully and treat restore as a replacement operation rather than routine cleanup.",
    "category": "recovery",
    "sections": [
      {
        "id": "create",
        "title": "Save a usable backup",
        "paragraphs": [
          "Data & backups can create an encrypted workspace archive when recovery is ready. The archive does not replace your separate backup of hosted photo or video originals. Passwords, active sessions, API keys and Google connections are excluded."
        ],
        "steps": [
          {
            "title": "Check readiness",
            "body": "Open Data & backups or Backups & recovery and read the recovery-key or verification message."
          },
          {
            "title": "Create the archive",
            "body": "When enabled, select Create encrypted backup and wait for the operation to finish."
          },
          {
            "title": "Save the file",
            "body": "Use Save file, or Save to Drive when available, and keep the original recovery key securely separate from the archive."
          }
        ],
        "screenshot": {
          "id": "backups",
          "caption": "Check readiness before creating or exporting an encrypted backup.",
          "alt": "Data and backups panel with archive and recovery controls."
        },
        "tips": []
      },
      {
        "id": "restore",
        "title": "Plan a restore before starting",
        "paragraphs": [
          "Restore from file replaces current workspace data. It signs users out, disables restored team accounts until fresh passwords are set, resets client links/reminders and requires provider reconnection. A backup file alone is not a reason to overwrite an active studio."
        ],
        "steps": [
          {
            "title": "Coordinate recovery",
            "body": "Have the owner verify the intended archive, recovery key and recovery timing before opening a restore."
          },
          {
            "title": "Read the restore review",
            "body": "Use Restore from file only for a deliberate recovery, checking all displayed replacement consequences."
          },
          {
            "title": "Verify after recovery",
            "body": "Review accounts, client links, reminders and connected providers before returning the team to normal work."
          }
        ],
        "screenshot": {
          "id": "backups",
          "caption": "This Settings view shows backup readiness and Review reset; use Restore from file only when available.",
          "alt": "Backup settings with readiness information and Review reset; no restore review is open."
        },
        "tips": []
      }
    ],
    "related": [
      "offline-drafts-activity",
      "team-access",
      "troubleshooting"
    ]
  },
  {
    "slug": "offline-drafts-activity",
    "title": "Recover local drafts and review recent activity",
    "summary": "Use supported device drafts as a safety net, and understand the limits of the studio’s shared notification list.",
    "category": "recovery",
    "sections": [
      {
        "id": "drafts",
        "title": "Recover a supported local draft",
        "paragraphs": [
          "Device copies cover supported enquiry, quotation and project-note fields. They are not a fully offline workspace or automatic invoice synchronization. Drafts expire after seven days and are removed on sign-out or studio switch; nothing sends automatically."
        ],
        "steps": [
          {
            "title": "Save a device copy",
            "body": "Use Save device copy or Save on this device when the editor offers that option."
          },
          {
            "title": "Open Offline drafts",
            "body": "Choose Continue for the relevant draft, or Refresh to update the local list."
          },
          {
            "title": "Review before restoring",
            "body": "Restore draft replaces editor fields. Check the content and save it to the studio before sharing; discard only a local draft you no longer need."
          }
        ],
        "screenshot": {
          "id": "offline-drafts",
          "caption": "Check the draft’s type and age before replacing current editor fields.",
          "alt": "Offline drafts hub with continuation and local-draft actions."
        },
        "tips": [
          "If a submission was unconfirmed, inspect the existing studio record before resubmitting to avoid a duplicate."
        ]
      },
      {
        "id": "activity",
        "title": "Read activity as notifications",
        "paragraphs": [
          "Studio activity shows the latest 20 shared notifications for full workspace administrators. It is useful for reminders and recent updates, but it is not a complete immutable audit of every action or a replacement for the underlying record."
        ],
        "steps": [
          {
            "title": "Open Activity",
            "body": "Review the notification title, description and time, then inspect the related business record when necessary."
          },
          {
            "title": "Manage attention",
            "body": "Use the individual read action or Mark all read after reviewing the relevant updates."
          },
          {
            "title": "Clear only intentionally",
            "body": "Clear activity removes notifications for the team; enquiries, projects, documents and payments remain."
          }
        ],
        "screenshot": {
          "id": "activity",
          "caption": "Activity is a shared notification list, so read and clear actions affect team attention.",
          "alt": "Studio activity with unread notifications and management actions."
        },
        "tips": []
      }
    ],
    "related": [
      "backups",
      "enquiries",
      "troubleshooting"
    ]
  },
  {
    "slug": "troubleshooting",
    "title": "Resolve common access and readiness questions",
    "summary": "Check the record, view, permission and connection state before repeating an action or attempting recovery.",
    "category": "recovery",
    "sections": [
      {
        "id": "record-visibility",
        "title": "Find the cause of a missing item",
        "paragraphs": [
          "Different states can look similar: a saved card may be hidden, a record may be filtered, a module may be restricted, or a client document may still be a draft. Start with the smallest explanation rather than resetting the workspace."
        ],
        "steps": [
          {
            "title": "Review the current view",
            "body": "Clear the relevant search/filter, check Today versus Insights and use the available card recovery controls."
          },
          {
            "title": "Check access and linkage",
            "body": "Ask the owner to verify your modules, then confirm the record’s client, enquiry and project relationship."
          },
          {
            "title": "Check publication state",
            "body": "For client information, verify quotation visibility, invoice issue and whether the production update was intentionally published."
          }
        ],
        "screenshot": {
          "id": "overview",
          "caption": "View and customization controls can explain an empty daily workspace.",
          "alt": "Overview with view selection and recovery controls."
        },
        "tips": []
      },
      {
        "id": "connection-errors",
        "title": "Handle errors without duplicating work",
        "paragraphs": [
          "Setup required, preview, read-only and permission messages are practical limits, not proof of a broken payment or provider connection. A sent request, saved draft or accepted quotation each has a different next step."
        ],
        "steps": [
          {
            "title": "Read the exact message",
            "body": "Check whether the action needs live configuration, provider authorization, owner access or an issued document."
          },
          {
            "title": "Verify before repeating",
            "body": "Refresh or reopen the saved record; for uncertain payment/message attempts, check the actual bank/provider or conversation result first."
          },
          {
            "title": "Ask for focused help",
            "body": "Give the owner the affected screen, record and message. Use the website’s existing Support link if the studio needs further assistance."
          }
        ],
        "screenshot": {
          "id": "integrations",
          "caption": "Read the service’s readiness state before reconnecting or repeating requests.",
          "alt": "Integration readiness cards with setup and preview messages."
        },
        "tips": []
      }
    ],
    "related": [
      "team-access",
      "integrations-ai",
      "offline-drafts-activity"
    ]
  }
];
