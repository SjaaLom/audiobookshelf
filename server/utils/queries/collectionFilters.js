const { QueryTypes } = require('sequelize')

const Database = require('../../Database')
const libraryItemsBookFilters = require('./libraryItemsBookFilters')

function escapeLike(value) {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function getVisibleBookSql(user) {
  const { bookWhere, replacements } = libraryItemsBookFilters.getUserPermissionBookWhereQuery(user)
  const sql = Database.sequelize.getQueryInterface().queryGenerator.whereItemsQuery(bookWhere)
  return { sql: sql || '1 = 1', replacements }
}

async function getCollectionSummaries({ libraryId, user, page, limit, sort, desc, filter }) {
  const direction = desc ? 'DESC' : 'ASC'
  const sortExpression = sort === 'name' ? 'c.name COLLATE NOCASE' : `c.${sort}`
  const visible = getVisibleBookSql(user)
  const filterSql = filter ? "AND c.name LIKE :filter ESCAPE '\\'" : ''
  const replacements = {
    ...visible.replacements,
    libraryId,
    limit,
    offset: page * limit,
    ...(filter ? { filter: `%${escapeLike(filter)}%` } : {})
  }
  const visibleMembership = `
    FROM collectionBooks cb
    JOIN books b ON b.id = cb.bookId
    WHERE cb.collectionId = c.id AND ${visible.sql}`

  const rows = await Database.sequelize.query(
    `SELECT c.id, c.libraryId, c.name, c.description, c.createdAt, c.updatedAt,
            (SELECT COUNT(*) ${visibleMembership}) AS numBooks
       FROM collections c
      WHERE c.libraryId = :libraryId ${filterSql}
        AND EXISTS (SELECT 1 ${visibleMembership})
      ORDER BY ${sortExpression} ${direction}, c.id ${direction}
      LIMIT :limit OFFSET :offset`,
    { replacements, type: QueryTypes.SELECT }
  )

  const [{ total }] = await Database.sequelize.query(
    `SELECT COUNT(*) AS total FROM collections c
      WHERE c.libraryId = :libraryId ${filterSql}
        AND EXISTS (SELECT 1 ${visibleMembership})`,
    { replacements, type: QueryTypes.SELECT }
  )

  const previews = rows.length
    ? await Database.sequelize.query(
        `WITH rankedPreviews AS (
           SELECT cb.collectionId, li.id, b.coverPath,
                  ROW_NUMBER() OVER (PARTITION BY cb.collectionId ORDER BY cb."order" ASC, cb.bookId ASC) AS previewRank
             FROM collectionBooks cb
             JOIN books b ON b.id = cb.bookId
             JOIN libraryItems li ON li.mediaId = b.id AND li.mediaType = 'book'
            WHERE cb.collectionId IN (:collectionIds) AND ${visible.sql}
         )
         SELECT collectionId, id, coverPath
           FROM rankedPreviews
          WHERE previewRank <= 2
          ORDER BY collectionId ASC, previewRank ASC`,
        { replacements: { ...visible.replacements, collectionIds: rows.map((collection) => collection.id) }, type: QueryTypes.SELECT }
      )
    : []
  const previewsByCollection = new Map()
  for (const preview of previews) {
    const items = previewsByCollection.get(preview.collectionId) || []
    items.push({ id: preview.id, media: { coverPath: preview.coverPath } })
    previewsByCollection.set(preview.collectionId, items)
  }
  for (const collection of rows) {
    collection.numBooks = Number(collection.numBooks)
    collection.createdAt = new Date(collection.createdAt).valueOf()
    collection.updatedAt = new Date(collection.updatedAt).valueOf()
    collection.previewItems = previewsByCollection.get(collection.id) || []
  }

  return { results: rows, total: Number(total) }
}

module.exports = { getCollectionSummaries }
