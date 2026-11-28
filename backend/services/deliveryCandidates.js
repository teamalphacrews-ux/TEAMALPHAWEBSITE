const PAGE_SIZE = 100;

async function* deliveryCandidates(Model, filter) {
  let after;
  while (true) {
    const query = after ? { ...filter, _id: { $gt: after } } : filter;
    const page = await Model.find(query).sort({ _id: 1 }).limit(PAGE_SIZE);
    // SMTP may keep a worker busy for several seconds per document. Finish the
    // database read before sending; no Mongo cursor waits on a mail provider.
    yield* page;
    if (page.length < PAGE_SIZE) return;
    after = page[page.length - 1]._id;
  }
}

module.exports = { deliveryCandidates };
