function inputError(message, status = 400) {
    return Object.assign(new Error(message), { status });
}

function accountDetails(body) {
    if (body.createAccount !== undefined && typeof body.createAccount !== 'boolean') {
        throw inputError('createAccount must be a boolean');
    }
    if (!body.createAccount) return null;
    const names = {};
    for (const field of ['firstName', 'lastName']) {
        if (typeof body[field] !== 'string' || !body[field].trim() || body[field].trim().length > 120) {
            throw inputError('First and last names are required for a client portal account');
        }
        names[field] = body[field].trim();
    }
    const rawEmail = body.accountEmail || body.email;
    if (typeof rawEmail !== 'string' || rawEmail.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail.trim())) {
        throw inputError('A valid account email is required');
    }
    if (typeof body.password !== 'string' || !body.password.trim() || Buffer.byteLength(body.password, 'utf8') > 72) {
        throw inputError('A non-empty portal password of at most 72 bytes is required');
    }
    return { ...names, email: rawEmail.trim().toLowerCase(), password: body.password };
}

function createLeadHandler({ Lead, User, Notification, bcrypt, allowedLeadFields, logger = console }) {
    return async (req, res) => {
        try {
            if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
                throw inputError('A JSON enquiry object is required');
            }
            const account = accountDetails(req.body);
            if (account) {
                // Existing emails may predate normalization. Check case-insensitively
                // before persisting either document; the unique index handles races.
                const emailPattern = account.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                if (await User.findOne({ email: new RegExp(`^${emailPattern}$`, 'i') })) {
                    throw inputError('A client account already exists with this email', 409);
                }
            }
            const lead = new Lead(allowedLeadFields(req.body));
            await lead.validate();
            let newUser;
            if (account) {
                const password = await bcrypt.hash(account.password, await bcrypt.genSalt(10));
                newUser = new User({
                    firstName: account.firstName, lastName: account.lastName, email: account.email,
                    password, role: 'client', leadId: lead._id,
                    galleryTag: lead.galleryTag, cloudLink: lead.cloudLink, cloudPassword: lead.cloudPassword
                });
                await newUser.validate();
            }

            await lead.save();
            if (newUser) {
                try {
                    await newUser.save();
                } catch (error) {
                    // These predicates only target records from this attempt. Also
                    // remove the new account if its insert succeeded but acknowledgement
                    // failed, preserving the pair without requiring replica transactions.
                    const cleanup = await Promise.allSettled([
                        User.deleteOne({ _id: newUser._id, leadId: lead._id }),
                        Lead.findByIdAndDelete(lead._id)
                    ]);
                    if (cleanup.some(result => result.status === 'rejected')) {
                        logger.error('Lead/account creation cleanup could not be confirmed');
                        return res.status(503).json({
                            error: 'Portal account creation failed and cleanup could not be confirmed. Check this enquiry before retrying.',
                            leadId: String(lead._id)
                        });
                    }
                    return res.status(error.code === 11000 ? 409 : 500).json({
                        error: error.code === 11000 ? 'A client account already exists with this email' : 'Unable to create the client portal account; no enquiry was saved'
                    });
                }
            }

            // The enquiry and optional account are committed. An activity-feed
            // failure must not report failed creation and invite a duplicate retry.
            try {
                await Notification.create({
                    title: 'New Lead Acquired',
                    description: `${lead.name} has been added to the registry as a new ${lead.status} lead.`,
                    type: 'Lead'
                });
            } catch (error) {
                logger.error('Lead created; activity notification unavailable:', error.name);
            }
            return res.json(lead);
        } catch (error) {
            const status = error.status || (error.name === 'ValidationError' ? 400 : 500);
            if (status >= 500) logger.error('Lead creation failed:', error.name);
            return res.status(status).json({ error: status < 500 ? error.message : 'Unable to create the enquiry' });
        }
    };
}

module.exports = { createLeadHandler };
