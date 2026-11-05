function createRuntimeReadiness({
    connect,
    getConnectionState,
    models,
    logger = console,
    environment = process.env.NODE_ENV || 'production',
}) {
    let initialized = false;
    let initialization;
    const isReady = () => initialized && getConnectionState() === 1;

    function initialize(startWorkers = () => {}) {
        if (!initialization) {
            initialization = (async () => {
                try {
                    await connect();
                    if (getConnectionState() !== 1) throw new Error('Database unavailable');
                    // createIndexes adds declared indexes; it never removes existing indexes.
                    // Await every model before admitting requests or starting delivery jobs.
                    for (const model of models) await model.createIndexes();
                    if (getConnectionState() !== 1) throw new Error('Database unavailable');
                    await startWorkers();
                    initialized = true;
                    return isReady();
                } catch {
                    initialized = false;
                    logger.error('Studio API initialization failed. Verify database access and index configuration.');
                    return false;
                }
            })();
        }
        return initialization;
    }

    function health(_req, res) {
        const ready = isReady();
        res.set('Cache-Control', 'no-store');
        return res.status(ready ? 200 : 503).json({
            status: ready ? 'Online' : 'Unavailable',
            ready,
            environment,
            database: getConnectionState() === 1 ? 'Connected' : 'Disconnected',
            timestamp: new Date().toISOString(),
        });
    }

    function requireReady(_req, res, next) {
        if (isReady()) return next();
        res.set('Cache-Control', 'no-store');
        res.set('Retry-After', '30');
        return res.status(503).json({
            error: 'Studio services are temporarily unavailable. Please retry shortly.',
            ready: false,
        });
    }

    return { initialize, isReady, health, requireReady };
}

module.exports = { createRuntimeReadiness };
