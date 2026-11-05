// Used only by the explicitly requested development preview, never as account state.
export function createWorkspacePreview() {
  const futureDate = days => new Date(Date.now() + days * 86400000).toISOString();
  return {
    role: 'owner',
    workspace: {
      id: 'saas-preview-workspace',
      name: 'Team Alpha · Sample workspace',
      slug: 'team-alpha-demo',
      planId: 'starter',
      subscriptionStatus: 'trialing',
      trialEndsAt: futureDate(14),
    },
    seats: { used: 4, limit: 5 },
    members: [
      { id: 'saas-preview-owner', firstName: 'Studio', lastName: 'Owner', email: 'owner@example.com', role: 'owner' },
      { id: 'saas-preview-admin', firstName: 'Studio', lastName: 'Manager', email: 'manager@example.com', role: 'admin' },
      { id: 'saas-preview-staff', firstName: 'Creative', lastName: 'Team', email: 'creative@example.com', role: 'staff' },
    ],
    invitations: [
      { id: 'saas-preview-invitation', email: 'editor@example.com', role: 'staff', expiresAt: futureDate(7) },
    ],
    billing: { configured: false },
    plans: [
      { id: 'starter', name: 'Starter', seatLimit: 5, features: ['Client enquiries and projects', 'Quotes, invoices and smart links', 'Calendar and production tracking'] },
      { id: 'studio', name: 'Studio', seatLimit: 15, features: ['Everything in Starter', 'Up to 15 team members', 'More room for a growing studio'] },
      { id: 'scale', name: 'Scale', seatLimit: 50, features: ['Everything in Studio', 'Up to 50 team members', 'For studios with several teams'] },
    ].map(plan => ({ ...plan, currency: 'INR', monthlyAmount: null, configured: false })),
  };
}
