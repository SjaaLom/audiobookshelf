const migrationVersion = '2.37.0'
const loggerPrefix = `[${migrationVersion} migration]`

const indexes = [
  {
    table: 'collections',
    name: 'collections_library_id_name_nocase_id',
    sql: 'CREATE INDEX collections_library_id_name_nocase_id ON collections (libraryId, name COLLATE NOCASE, id)'
  },
  {
    table: 'collectionBooks',
    name: 'collection_books_collection_id_order_book_id',
    sql: 'CREATE INDEX collection_books_collection_id_order_book_id ON collectionBooks (collectionId, `order`, bookId)'
  }
]

async function hasIndex(queryInterface, index) {
  return (await queryInterface.showIndex(index.table)).some((existing) => existing.name === index.name)
}

async function up({ context: { queryInterface, logger } }) {
  for (const index of indexes) {
    if (await hasIndex(queryInterface, index)) continue
    logger.info(`${loggerPrefix} adding index ${index.name}`)
    await queryInterface.sequelize.query(index.sql)
  }
}

async function down({ context: { queryInterface, logger } }) {
  for (const index of indexes) {
    if (!(await hasIndex(queryInterface, index))) continue
    logger.info(`${loggerPrefix} removing index ${index.name}`)
    await queryInterface.removeIndex(index.table, index.name)
  }
}

module.exports = { up, down }
