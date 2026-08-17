const { Request, Response, NextFunction } = require('express')

const collectionFilters = require('../utils/queries/collectionFilters')

/**
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
 *
 * @typedef RequestLibraryObject
 * @property {import('../models/Library')} library
 *
 * @typedef CollectionSummaryQueryObject
 * @property {number} page
 * @property {number} limit
 * @property {string} sort
 * @property {boolean} desc
 * @property {string} filter
 *
 * @typedef {RequestWithUser & RequestLibraryObject & { collectionSummaryQuery: CollectionSummaryQueryObject }} CollectionV2ControllerRequest
 */

const defaultQuery = {
  page: 0,
  limit: 20,
  sort: 'name',
  desc: false,
  filter: ''
}

class CollectionV2Controller {
  constructor() {}

  /**
   * Validate and normalize collection query parameters
   *
   * @param {Request} req
   * @param {Response} res
   * @param {NextFunction} next
   */
  validateQuery(req, res, next) {
    const integerPattern = /^(0|[1-9]\d*)$/

    if (req.query.page !== undefined && (typeof req.query.page !== 'string' || !integerPattern.test(req.query.page))) {
      return res.status(400).send('Invalid request. Page must be a non-negative integer')
    }
    if (req.query.limit !== undefined && (typeof req.query.limit !== 'string' || !integerPattern.test(req.query.limit))) {
      return res.status(400).send('Invalid request. Limit must be an integer between 1 and 100')
    }
    if (req.query.sort !== undefined && (typeof req.query.sort !== 'string' || !['name', 'createdAt', 'updatedAt'].includes(req.query.sort))) {
      return res.status(400).send('Invalid request. Sort must be name, createdAt, or updatedAt')
    }
    if (req.query.desc !== undefined && (typeof req.query.desc !== 'string' || !['0', '1'].includes(req.query.desc))) {
      return res.status(400).send('Invalid request. Desc must be 0 or 1')
    }
    if (req.query.filter !== undefined && typeof req.query.filter !== 'string') {
      return res.status(400).send('Invalid request. Filter must be a string')
    }

    const page = req.query.page === undefined ? defaultQuery.page : Number(req.query.page)
    const limit = req.query.limit === undefined ? defaultQuery.limit : Number(req.query.limit)

    if (!Number.isSafeInteger(page)) {
      return res.status(400).send('Invalid request. Page must be a non-negative integer')
    }
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      return res.status(400).send('Invalid request. Limit must be an integer between 1 and 100')
    }
    if (!Number.isSafeInteger(page * limit)) {
      return res.status(400).send('Invalid request. Page and limit exceed the supported range')
    }

    req.collectionSummaryQuery = {
      page,
      limit,
      sort: req.query.sort || defaultQuery.sort,
      desc: req.query.desc === '1',
      filter: req.query.filter || defaultQuery.filter
    }
    next()
  }

  /**
   * GET: /api/v2/libraries/:id/collections
   *
   * @param {CollectionV2ControllerRequest} req
   * @param {Response} res
   */
  async findAll(req, res) {
    const options = req.collectionSummaryQuery
    const payload = await collectionFilters.getCollectionSummaries({
      libraryId: req.library.id,
      user: req.user,
      ...options
    })

    res.json({
      ...payload,
      limit: options.limit,
      page: options.page,
      sortBy: options.sort,
      sortDesc: options.desc,
      filterBy: options.filter
    })
  }
}

module.exports = new CollectionV2Controller()
