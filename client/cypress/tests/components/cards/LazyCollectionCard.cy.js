import LazyBookshelf from '@/components/app/LazyBookshelf.vue'
import LazyCollectionCard from '@/components/cards/LazyCollectionCard.vue'

describe('LazyCollectionCard', () => {
  const previewItems = [
    { id: 'book-1', media: { coverPath: 'cover1.jpg' } },
    { id: 'book-2', media: { coverPath: 'cover2.jpg' } }
  ]
  const collection = {
    id: 'collection-1',
    libraryId: 'library-1',
    name: 'Favorites',
    description: 'Favorite books',
    numBooks: 12,
    previewItems
  }
  const store = {
    getters: {
      'libraries/getBookCoverAspectRatio': 1,
      'user/getSizeMultiplier': 1,
      'user/getUserCanUpdate': true
    },
    state: {
      libraries: {
        currentLibraryId: 'library-1'
      }
    }
  }
  const mountOptions = {
    propsData: {
      index: 0,
      width: 240,
      collectionMount: collection
    },
    mocks: {
      $store: store,
      $constants: { BookshelfView: { DETAIL: 1 } },
      $router: { push: () => {} }
    },
    stubs: {
      'covers-collection-cover': {
        props: ['bookItems'],
        template: '<div data-cy="collection-cover"><span v-for="item in bookItems" :key="item.id">{{ item.id }}</span></div>'
      }
    }
  }

  it('renders the collection summary using bounded preview items', () => {
    cy.mount(LazyCollectionCard, mountOptions)

    cy.get('[data-cy="collection-cover"]').should('have.text', 'book-1book-2')
    cy.contains('Favorites').should('be.visible')
  })

  it('does not fall back to expanded collection books', () => {
    const expandedOnly = { ...collection, previewItems: undefined, books: previewItems }

    cy.mount(LazyCollectionCard, {
      ...mountOptions,
      propsData: { ...mountOptions.propsData, collectionMount: expandedOnly }
    })

    cy.get('[data-cy="collection-cover"]').should('have.text', '')
  })

  it('shows the RSS marker for the summary flag or legacy feed details', () => {
    cy.mount(LazyCollectionCard, {
      ...mountOptions,
      propsData: { ...mountOptions.propsData, collectionMount: { ...collection, hasRssFeed: true } }
    })
    cy.get('[data-cy="collection-rss-marker"]').should('be.visible')

    cy.mount(LazyCollectionCard, {
      ...mountOptions,
      propsData: { ...mountOptions.propsData, collectionMount: { ...collection, hasRssFeed: false } }
    })
    cy.get('[data-cy="collection-rss-marker"]').should('not.exist')

    cy.mount(LazyCollectionCard, mountOptions)
    cy.get('[data-cy="collection-rss-marker"]').should('not.exist')

    cy.mount(LazyCollectionCard, {
      ...mountOptions,
      propsData: {
        ...mountOptions.propsData,
        collectionMount: { ...collection, rssFeed: { id: 'legacy-feed', slug: 'favorites' } }
      }
    })
    cy.get('[data-cy="collection-rss-marker"]').should('be.visible')
  })

  it('routes to the collection when clicked', () => {
    cy.mount(LazyCollectionCard, {
      ...mountOptions,
      mocks: {
        ...mountOptions.mocks,
        $router: { push: cy.stub().as('routerPush') }
      }
    })

    cy.get('#collection-card-0').click()
    cy.get('@routerPush').should('have.been.calledOnceWithExactly', '/collection/collection-1')
  })
})

describe('LazyBookshelf collection requests', () => {
  it('caps large collection pages without changing other bookshelf page sizes', () => {
    const makeBookshelf = (entityName) => ({
      entityName,
      entitiesPerShelf: 8,
      shelfPadding: 0,
      totalEntityCardWidth: 10,
      shelfHeight: 10,
      sizeMultiplier: 1,
      totalEntities: 0,
      booksPerFetch: 0,
      bookWidth: 10
    })
    const bookshelfElement = { clientHeight: 40, clientWidth: 200 }
    const collectionsBookshelf = makeBookshelf('collections')
    const itemsBookshelf = makeBookshelf('items')

    LazyBookshelf.methods.initSizeData.call(collectionsBookshelf, bookshelfElement)
    LazyBookshelf.methods.initSizeData.call(itemsBookshelf, bookshelfElement)

    expect(collectionsBookshelf.entitiesPerShelf * collectionsBookshelf.shelvesPerPage).to.equal(120)
    expect(collectionsBookshelf.booksPerFetch).to.equal(100)
    expect(itemsBookshelf.booksPerFetch).to.equal(120)
  })

  it('builds a paginated v2 request with supported collection parameters only', () => {
    const path = LazyBookshelf.methods.buildCollectionsRequestPath.call({
      booksPerFetch: 24,
      currentLibraryId: 'library-1',
      $route: { query: { sort: 'updatedAt', desc: '1', filter: 'favorites' } }
    }, 2)

    expect(path).to.equal('/api/v2/libraries/library-1/collections?page=2&limit=24&sort=updatedAt&desc=1&filter=favorites')
    expect(path).not.to.include('minified')
    expect(path).not.to.include('include')
  })

  it('normalizes unsupported collection sort and filter values', () => {
    const path = LazyBookshelf.methods.buildCollectionsRequestPath.call({
      booksPerFetch: 12,
      currentLibraryId: 'library-1',
      $route: { query: { sort: 'numBooks', desc: true, filter: ['invalid'] } }
    }, 0)

    expect(path).to.equal('/api/v2/libraries/library-1/collections?page=0&limit=12&sort=name&desc=0&filter=')
  })

  it('preserves the legacy request for other bookshelf entities', () => {
    const path = LazyBookshelf.methods.buildBookshelfRequestPath.call({
      entityName: 'items',
      currentLibraryId: 'library-1',
      currentSFQueryString: 'sort=media.metadata.title&desc=0',
      booksPerFetch: 30
    }, 3)

    expect(path).to.equal('/api/libraries/library-1/items?sort=media.metadata.title&desc=0&limit=30&page=3&minified=1&include=rssfeed,numEpisodesIncomplete,share')
  })
})
