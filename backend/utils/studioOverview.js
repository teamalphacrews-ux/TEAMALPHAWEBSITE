const PIPELINE_STATUSES = ['New', 'Follow-up', 'Meeting', 'Negotiation', 'Converted', 'Archived'];

function buildStudioOverview(data, now = new Date()) {
    const counts = new Map(data.leadCounts.map(item => [item._id, item.count]));
    const pipeline = PIPELINE_STATUSES.map(status => ({ status, count: counts.get(status) || 0 }));
    const totalEnquiries = data.leadCounts.reduce((sum, item) => sum + item.count, 0);
    const bookedProjects = counts.get('Converted') || 0;

    return {
        generatedAt: now.toISOString(),
        summary: {
            totalEnquiries,
            openEnquiries: totalEnquiries - bookedProjects - (counts.get('Archived') || 0),
            bookedProjects,
            upcomingEvents: data.upcomingEventCount,
            pendingTasks: data.pendingTaskCount,
            overdueTasks: data.overdueTaskCount,
            activeCrew: data.activeCrew,
            clientCollections: data.clientCollections
        },
        pipeline,
        upcomingEvents: data.events.map(event => ({
            _id: event._id, title: event.title, start: event.start, end: event.end,
            type: event.type, location: event.location || '', teamMembers: event.teamMembers || [],
            lead: event.lead || null
        })),
        actionQueue: [...data.datedTasks, ...data.undatedTasks].slice(0, 8).map(task => ({
            _id: task._id, title: task.title, dueDate: task.dueDate || null,
            status: task.status, lead: task.lead ? {
                _id: task.lead._id, name: task.lead.name, eventDate: task.lead.eventDate || null
            } : null
        })),
        recentEnquiries: data.recentLeads.map(lead => ({
            _id: lead._id, name: lead.name, eventType: lead.eventType || '',
            eventDate: lead.eventDate || null, status: lead.status,
            followUpDate: lead.followUpDate || null, createdAt: lead.createdAt
        }))
    };
}

module.exports = { buildStudioOverview, PIPELINE_STATUSES };
