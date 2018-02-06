"use strict";

// Tracking indexes are required to determine a tab to activate when the current tab is closed.
// Lock is to prevent handling of `onActivated` events during handling of `onRemoved` events.
let activeTabId = {};
let activeTabIndex = {};
let onActivatedLock = {};

// Logging functions, replace with empty functions to disable logging.
const log = (method, args) => {
    args.unshift('[tabcontrol]');
    console[method].apply(console, args);
};
const debug = (...args) => log('debug', args);
const error = (...args) => log('error', args);

const logIndex = (windowId) => debug('current tab', activeTabId[windowId], 'at', activeTabIndex[windowId]);

// Function to handle `browser.tabs.query` results that return a single tab.
// Logs error if unexpected count of tabs were returned.
const assertSingleTab = (tabs, then) => {
    if (tabs.length !== 1) {
        error('Query expected to return', 1, 'tab, but got', tabs.length);
        return;
    }
    then(tabs[0]);
};

// Updates tracking indexes (tab ID, index) and resets lock status.
const trackActiveTab = (tab) => {
    activeTabId[tab.windowId] = tab.id;
    activeTabIndex[tab.windowId] = tab.index;
    onActivatedLock[tab.windowId] = false;
    logIndex(tab.windowId);
};

// When a tab has been activated, track index of the tab that should receive focus on active tab
// close (current index minus one, or or zero if the current tab is the first one).
browser.tabs.onActivated.addListener((activeInfo) => {
    if (onActivatedLock[activeInfo.windowId]) {
        return;
    }
    debug('Activated', activeInfo.tabId);
    // Must query the active tab before accessing its current index.
    browser.tabs
        .get(activeInfo.tabId)
        .then(trackActiveTab, error);
});

// When a tab has been attached before the currently active one, increment the tracked index
// by one since there's one more tab now.
browser.tabs.onAttached.addListener((tabId, attachInfo) => {
    debug('Attached', tabId);
    if (attachInfo.newPosition <= activeTabIndex[attachInfo.newWindowId]) {
        activeTabIndex[attachInfo.newWindowId]++;
        logIndex(attachInfo.oldWindowId);
    }
});

// When a tab has been detached before the currently active one, decrement the tracked index
// by one since there's one tab less now.
browser.tabs.onDetached.addListener((tabId, detachInfo) => {
    debug('Detached', tabId);
    if (detachInfo.oldPosition <= activeTabIndex[detachInfo.oldWindowId]) {
        activeTabIndex[detachInfo.oldWindowId]--;
        logIndex(detachInfo.oldWindowId);
    }
});

// When a tab has been moved from or to a position before the currently active tab (exclusive or),
// increment or decrement the tracked index accordingly since now there's one more or one tab less.
browser.tabs.onMoved.addListener((tabId, moveInfo) => {
    debug('Moved', tabId);
    if (activeTabId[moveInfo.windowId] === tabId) {
        // Moving active tab, just update its tracking index.
        // Note: when moving tabs manually, the moved tabs become active, therefore only this
        // branch of code is expected to be executed. The other two `else if` parts are supposed
        // to handle tabs moved programmatically, but they're not tested.
        activeTabIndex[moveInfo.windowId] = moveInfo.toIndex;
    }
    else if (moveInfo.fromIndex < activeTabIndex[moveInfo.windowId]
        && moveInfo.toIndex > activeTabIndex[moveInfo.windowId]
    ) {
        // One tab less before the currently active one, decrement tracking index.
        debug('decrement');
        activeTabIndex[moveInfo.windowId]--;
    }
    else if (moveInfo.fromIndex > activeTabIndex[moveInfo.windowId]
        && moveInfo.toIndex < activeTabIndex[moveInfo.windowId]
    ) {
        // One more tab before the currently active one, increment tracking index.
        debug('increment');
        activeTabIndex[moveInfo.windowId]++;
    }
    logIndex(moveInfo.windowId);
});

// Move newly open tab to be one to the right of the opener tab, if not already at that position.
// Also if the position of the new tab is before the currently active one, incerment the tracked
// index by one since there's one more tab now.
browser.tabs.onCreated.addListener((newTab) => {
    debug('Created', newTab.id);
    if (newTab.openerTabId) {
        // Only move if a tab has been opened from another tab.
        // 'Independent' tabs, such as search results, will appear at their default place.
        browser.tabs
            .get(newTab.openerTabId)
            .then(
                (openerTab) => {
                    if (newTab.index - openerTab.index !== 1) {
                        // Only move if the new index is not right after the opener tab index.
                        browser.tabs
                            .move(newTab.id, {index: openerTab.index + 1})
                            .then(() => {}, error);
                    }
                },
                error
            );
    }
    if (newTab.index < activeTabIndex[newTab.windowId]) {
        activeTabIndex[newTab.windowId]++;
        logIndex(newTab.windowId);
    }
});

// Make active tab to be one to the left of the closed tab, if it had focus.
browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
    debug('Removed', tabId);
    if (removeInfo.isWindowClosing) {
        // No point in doing anything if the whole window is going to close.
        return;
    }
    onActivatedLock[removeInfo.windowId] = true;
    debug('current index', activeTabIndex[removeInfo.windowId]);
    if (tabId === activeTabId[removeInfo.windowId] && activeTabIndex[removeInfo.windowId] > 0) {
        // Closing active tab and there are some more on the left.
        debug('query tab at', activeTabIndex[removeInfo.windowId] - 1);
        browser.tabs
            .query({windowId: removeInfo.windowId, index: activeTabIndex[removeInfo.windowId] - 1})
            .then(
                (tabs) => {
                    assertSingleTab(tabs, (tab) => {
                        debug('activate tab', tab.id, 'at', tab.index);
                        browser.tabs
                            .update(tab.id, {active: true})
                            .then(trackActiveTab, error);
                    });
                },
                error
            );
    }
    else {
        // Closing first or non-active tab. Must find out the active tab and update tracking indexes.
        browser.tabs
            .query({windowId: removeInfo.windowId, active: true})
            .then(
                (tabs) => assertSingleTab(tabs, trackActiveTab),
                error
            );
    }
});

// Set initial values on extension load.
browser.tabs
    .query({currentWindow: true, active: true})
    .then(
        (tabs) => assertSingleTab(tabs, trackActiveTab),
        error
    );
