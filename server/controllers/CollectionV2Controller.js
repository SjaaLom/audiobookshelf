const collectionFilters = require('../utils/queries/collectionFilters')

const defaults = { page: 0, limit: 20, sort: 'name', desc: false, filter: '' }
const badRequestMessage = 'Invalid collection summary query parameters'

class CollectionV2Controller {
  parseQuery(req, res, next) {
    const query = req.query
    const integer = /^(0|[1-9]\d*)$/
    const supported = ['page', 'limit', 'sort', 'desc', 'filter']
    if (Object.keys(query).some((key) => !supported.includes(key))) return res.status(400).json({ error: badRequestMessage })
    if (
      (query.page !== undefined && (typeof query.page !== 'string' || !integer.test(query.page))) ||
      (query.limit !== undefined && (typeof query.limit !== 'string' || !integer.test(query.limit)))
    ) {
      return res.status(400).json({ error: badRequestMessage })
    }
    const page = query.page === undefined ? defaults.page : Number(query.page)
    const limit = query.limit === undefined ? defaults.limit : Number(query.limit)
    const sort = query.sort === undefined ? defaults.sort : query.sort
    if (
      !Number.isSafeInteger(page) ||
      !Number.isSafeInteger(limit) ||
      !Number.isSafeInteger(page * limit) ||
      limit < 1 ||
      limit > 100 ||
      typeof sort !== 'string' ||
      !['name', 'createdAt', 'updatedAt'].includes(sort) ||
      (query.desc !== undefined && (typeof query.desc !== 'string' || !['0', '1'].includes(query.desc)))
    ) {
      return res.status(400).json({ error: badRequestMessage })
    }
    if (query.filter !== undefined && typeof query.filter !== 'string') return res.status(400).json({ error: badRequestMessage })
    req.collectionSummaryQuery = { page, limit, sort, desc: query.desc === '1', filter: query.filter || '' }
    next()
  }

  async findAll(req, res) {
    const options = req.collectionSummaryQuery
    const payload = await collectionFilters.getCollectionSummaries({ libraryId: req.library.id, user: req.user, ...options })
    res.json({ ...payload, limit: options.limit, page: options.page, sortBy: options.sort, sortDesc: options.desc, filterBy: options.filter })
  }
}

module.exports = new CollectionV2Controller()
