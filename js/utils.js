
// Globals
const shortcuts = {
  defaultOptions: {
    // Style selected search result
    styleSelectedSimple: false,

    styleSelectedFancy: true,

    // Activate search box when any printable key is pressed
    activateSearch: false,

    // Automatically select the first search result.
    autoselectFirst: true,

    // Navigate between results using

    // Next = Tab; Previous = Shift + TAB
    navigateWithTabs: true,

    // Next = Down; Previous = Up
    navigateWithArrows: true,

    // Next = j; Previous = k [WARNING: Conflicts with activateSearch. This takes precedence.]
    navigateWithJK: true,

    // Esc = select all text in search box
    selectTextInSearchbox: true,

    // Add space on focus
    addSpaceOnFocus: true,

    // Enable Google special bindings
    enableGoogleShortcuts: true
  },

  focusIndex: -1,

  inputElementIds: ['cwtltblr' /* Google Calculator Widget */],
  inputElementTypes: ['text', 'number', 'textarea'],

  // Finds all currently visible search result links.
  // Unfortunately Google does not clearly mark search result links with a
  // unique selector, so this selector is a brittle heuristic that may break any
  // time Google changes the DOM structure / selectors, requiring a patch update
  // of the addon to be pushed.
  // It may be beneficial to make this selector (or all of them)
  // user-configurable, to enable users to temporarily fix it themselves, until
  // a new patch update is out. We may also want to investigate a different
  // approach, that e.g. does not only rely on a query selector, but includes
  // additional heuristics, to improve the resiliency.
  visibleResultsQuerySelector:
    // Select all links in the main search results container, including
    // non-search-result noise, like web cache, feedback, and further UI.
    '#search a' +
    // This selection is further refined with these filters:
    // All actual search results have a `data-ved` attribute, but not all links
    // with that attribute are search results.
    '[data-ved]' +
    // Some of them are interactive UI elements, like web cache, feedback, etc.
    // They can be identified by the lack of a real target `href`.
    ':not([href="#"])' +
    // Google started inlining related questions and their search results as an
    // accordion-type UI in an optional "People also ask" section. All accordion
    // items are collapsed by default and marked as `aria-hidden` in that state.
    // This filter excludes links that are invisible, as they are nested in a
    // hidden ancestor element.
    ':not([aria-hidden="true"] a)',

  resultContainerQuerySelector: [
    'div[jscontroller][data-ved]', // Standard web result
    'div[lang][data-hveid][data-ved]', // Web result with site links

    // Pagination
    'td',

    // Obsolete / Possible fallbacks? Search results
    'div.gs_r',
    'div.g',
    'li'
  ].join(', '),
  navigationContainerQuerySelector: 'div[role="navigation"] table',
  navigationLinksAndSuggestedSearchesQuerySelector: 'div[role="navigation"] table a, #botstuff a',

  saveOptions(options, callback) {
    chrome.storage.sync.set(options, callback);
  },

  loadOptions(callback) {
    chrome.storage.sync.get(this.defaultOptions, callback);
  },

  isElementVisible(element) {
    return element && (element.offsetWidth > 0 || element.offsetHeight > 0) && window.getComputedStyle(element).visibility !== 'hidden';
  },

  getVisibleResults() {
    const containers = [];
    return [
      // Main items
      ...Array.from(document.querySelectorAll(this.visibleResultsQuerySelector)).map(element => ({
        container: this.findContainer(element, containers),
        focusElement: element
      })),
      // Suggested searches in footer and footer links
      ...Array.from(document.querySelectorAll(this.navigationLinksAndSuggestedSearchesQuerySelector)).map(element => ({
        container: element,
        focusElement: element
      }))
    ].filter(target => target.container !== null && this.isElementVisible(target.focusElement));
  },

  hasModifierKey(event) {
    return event.shiftKey || event.altKey || event.ctrlKey || event.metaKey;
  },

  isInputActive() {
    const activeElement = document.activeElement;
    return activeElement && (activeElement.nodeName === 'INPUT' || this.inputElementTypes.includes(activeElement.type) || this.inputElementIds.includes(activeElement.id));
  },

  // Highlight the active result
  // Results without valid containers will be removed.
  findContainer(link, containers) {
    const container = link.closest(this.resultContainerQuerySelector);

    // Only return valid, unused containers
    if (container && !containers.includes(container)) {
      containers.push(container);
      return container;
    }
    return null;
  },

  // Add custom styling for the selected result (does not apply to footer navigation links)
  addResultHighlight(target) {
    // Don't proceed if the result is already highlighted or if we're dealing with footer navigation links
    if (target.container.classList.contains('activeSearchResultContainer') || target.focusElement.closest(this.navigationContainerQuerySelector)) {
      return;
    }

    target.container.classList.add('activeSearchResultContainer');
    target.focusElement.classList.add('activeSearchResult');

    const removeResultHighlight = () => {
      target.container.classList.remove('activeSearchResultContainer');
      target.focusElement.classList.remove('activeSearchResult');
      target.focusElement.removeEventListener('blur', removeResultHighlight);
    };

    target.focusElement.addEventListener('blur', removeResultHighlight);
  },

  resultObserver: null,
  scrollTimeout: null,

  focusResult(resultIndex) {
    const results = this.getVisibleResults();
    if (results.length === 0) return;

    // Shift focusIndex and perform boundary checks
    this.focusIndex = Math.max(0, Math.min(resultIndex, results.length - 1));

    const target = results[this.focusIndex];
    const rect = target.container.getBoundingClientRect();

    const scrolloff = 100;

    // Scroll the page if the target is too close to the bottom of the window
    if (rect.bottom > window.innerHeight - scrolloff) {
      window.scrollBy(0, rect.bottom - window.innerHeight + scrolloff);
    }

    // Scroll the page if the target is too close to the top of the window
    if (rect.top < scrolloff) {
      window.scrollBy(0, rect.top - scrolloff);
    }

    target.focusElement.focus();
    this.addResultHighlight(target);
    sessionStorage.setItem('lastLinkIndex', this.focusIndex);

    if (this.resultObserver) this.resultObserver.disconnect();

    // Create a new IntersectionObserver to detect if the focused link goes out of view
    this.resultObserver = new IntersectionObserver((entries) => {
      // Debounce scrolling event
      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = setTimeout(() => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) {
            // If scrolling down (link is out of view from the bottom), focus the next visible result
            if (entry.boundingClientRect.top < entry.rootBounds.top) {
              this.focusNextVisibleResult(results);
            }
            // If scrolling up (link is out of view from the top), focus the previous visible result
            else if (entry.boundingClientRect.bottom > entry.rootBounds.bottom) {
              this.focusPreviousVisibleResult(results);
            }
          }
        });
      }, 200);
    }, {
      root: null, // Observe relative to the viewport
      threshold: 0 // Trigger as soon as the element goes out of view
    });

    this.resultObserver.observe(target.container);
  },

  // Function to focus the next visible result
  focusNextVisibleResult(results) {
    if (results.length === 0) return;

    // Start searching from the current index + 1
    for (let i = this.focusIndex + 1; i < results.length; i++) {
      const rect = results[i].container.getBoundingClientRect();
      if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
        this.focusResult(i);
        break;
      }
    }
  },

  // Function to focus the previous visible result when scrolling up
  focusPreviousVisibleResult(results) {
    if (results.length === 0) return;

    // Start searching from the current index - 1
    for (let i = this.focusIndex - 1; i >= 0; i--) {
      const rect = results[i].container.getBoundingClientRect();
      if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
        this.focusResult(i);
        break;
      }
    }
  }
};

