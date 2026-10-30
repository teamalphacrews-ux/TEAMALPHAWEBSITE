const { currentWorkspace } = require('./tenantContext');

const installations = new WeakMap();
const GLOBAL_MODELS = new Set(['SaaSAccount', 'SaaSWorkspace', 'SaaSMembership', 'SaaSInvitation', 'SaaSBillingEvent', 'SaaSOAuthFlow', 'StudioPushDevice']);

/**
 * Queries and documents use a real Mongoose connection for their workspace.
 * Install before application models are required. Register global control-plane
 * models with mongoose.connection.model() instead of mongoose.model().
 */
function installTenantModels(mongoose = require('mongoose')) {
  if (installations.has(mongoose)) return installations.get(mongoose);
  const originalModel = mongoose.model;
  const legacyModels = mongoose.models;
  const proxies = new WeakMap(), originals = new WeakMap();
  let registering = 0;

  function ensureWorkspaceModels(connection) {
    // Register every known schema, not merely the requested one: populate()
    // must resolve all references on the same database connection.
    for (const [name, model] of Object.entries(legacyModels)) {
      if (GLOBAL_MODELS.has(name) || !model?.schema || connection.models[name]) continue;
      connection.model(name, model.schema, model.collection.name);
    }
  }

  function resolveModel(legacyModel) {
    const workspace = currentWorkspace();
    if (registering || !workspace || GLOBAL_MODELS.has(legacyModel.modelName)) return legacyModel;
    const connection = mongoose.connection.useDb(workspace.databaseName, { useCache: true });
    ensureWorkspaceModels(connection);
    const model = connection.models[legacyModel.modelName];
    if (!model) throw new Error('Workspace model registration failed.');
    return model;
  }

  function routedCollection(legacyModel) {
    const methods = new Map();
    return new Proxy(legacyModel.collection, {
      get(_target, key) {
        const collection = resolveModel(legacyModel).collection;
        const value = Reflect.get(collection, key, collection);
        if (typeof value !== 'function') return value;
        if (!methods.has(key)) methods.set(key, function (...args) {
          const selected = resolveModel(legacyModel).collection;
          return Reflect.apply(Reflect.get(selected, key, selected), selected, args);
        });
        return methods.get(key);
      },
      set(_target, key, value) {
        const selected = resolveModel(legacyModel).collection;
        return Reflect.set(selected, key, value, selected);
      },
    });
  }

  function routeModel(model) {
    if (!model || originals.has(model) || !model.schema || GLOBAL_MODELS.has(model.modelName)) return model;
    if (proxies.has(model)) return proxies.get(model);
    const methods = new Map(), collection = routedCollection(model);
    const proxy = new Proxy(model, {
      get(_target, key) {
        if (key === 'collection') return collection;
        const selected = resolveModel(model), value = Reflect.get(selected, key, selected);
        // Resolve at invocation, even if a static was destructured before a
        // request started. Query/document results bind at their creation.
        if (typeof value !== 'function' || key === 'constructor') return value;
        if (!methods.has(key)) methods.set(key, function (...args) {
          const selected = resolveModel(model);
          return Reflect.apply(Reflect.get(selected, key, selected), selected, args);
        });
        return methods.get(key);
      },
      construct(_target, args) {
        const selected = resolveModel(model);
        return Reflect.construct(selected, args, selected);
      },
      apply(_target, receiver, args) { return Reflect.apply(resolveModel(model), receiver, args); },
      set(_target, key, value) {
        const selected = resolveModel(model);
        return Reflect.set(selected, key, value, selected);
      },
    });
    proxies.set(model, proxy); originals.set(proxy, model);
    return proxy;
  }

  // Preserve the raw connection registry for Mongoose's population/compilation.
  // Application imports using mongoose.models.X still get a stable dispatcher.
  mongoose.models = new Proxy(legacyModels, {
    get(target, key, receiver) { return routeModel(Reflect.get(target, key, receiver)); },
  });
  mongoose.model = function (...args) {
    registering++;
    try { return routeModel(Reflect.apply(originalModel, mongoose, args)); }
    finally { registering--; }
  };

  const installation = Object.freeze({ ensureWorkspaceModels });
  installations.set(mongoose, installation);
  return installation;
}

module.exports = { installTenantModels };
