"use strict";

// Tracking indexes are required to determine a tab to activate when the current tab is closed.
let activeTabId = {};
let activeTabIndex = {};

// Activated lock is to prevent handling of `onActivated` events during handling of `onRemoved` events.
let onActivatedLock = {};

// Window lock is to prevent handling of tabs events in windows that have just been open.
// Also a helper function to check whether the window lock is still active.
let windowsLock = {};
const windowLockTimeout = 500;
const isWindowLocked = (windowId) => windowId in windowsLock;

// Flag to track activated/deactivated status.
let initialized = false;

// Logging functions, replace with empty functions to disable logging.
const log = (method, args) => {
    args.unshift('[tabcontrol]');
    console[method].apply(console, args);
};
const debug = (...args) => log('debug', args);
const error = (...args) => log('error', args);

const logInWindowContext = (windowId, ...args) => {
    if (isWindowLocked(windowId)) {
        args.unshift('🔒');
    }
    debug(...args);
};
const logIndex = (windowId) => logInWindowContext(windowId, 'current tab', activeTabId[windowId], 'at', activeTabIndex[windowId]);

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

// Find the currently active tab and update tracking indexes.
const refreshActiveTab = (windowId) => {
    browser.tabs
        .query({windowId: windowId, active: true})
        .then(
            (tabs) => assertSingleTab(tabs, trackActiveTab),
            error
        );
};

const refreshWindowLock = (windowId) => {
    if (isWindowLocked(windowId)) {
        clearTimeout(windowsLock[windowId]);
    }
    windowsLock[windowId] = setTimeout(
        () => {
            delete windowsLock[windowId];
            refreshActiveTab(windowId);
        },
        windowLockTimeout
    );
};

// When a window has been just open, prevent effects of this add-on on its tabs for a brief period.
const onWindowOpen = (window) => {
    refreshWindowLock(window.id);
};

// When a tab has been activated, track its index and ID as the current.
const onTabActivated = (activeInfo) => {
    logInWindowContext(activeInfo.windowId, 'Activated', activeInfo.tabId);

    if (isWindowLocked(activeInfo.windowId)) {
        // Don't do anything while there is still a lock on the window.
        return;
    }
    else if (onActivatedLock[activeInfo.windowId]) {
        // Also don't do anything if there is still a lock on the active tab.
        return;
    }

    // Must query the active tab before accessing its current index.
    browser.tabs
        .get(activeInfo.tabId)
        .then(trackActiveTab, error);
};

// When a tab has been attached before the currently active one, increment the tracked index
// by one since there's one more tab now.
const onTabAttached = (tabId, attachInfo) => {
    logInWindowContext(attachInfo.newWindowId, 'Attached', tabId);

    if (isWindowLocked(attachInfo.newWindowId)) {
        // Don't do anything while there is still a lock on the window.
        return;
    }
    else if (attachInfo.newPosition <= activeTabIndex[attachInfo.newWindowId]) {
        activeTabIndex[attachInfo.newWindowId]++;
        logIndex(attachInfo.oldWindowId);
    }
};

// When a tab has been detached before the currently active one, decrement the tracked index
// by one since there's one tab less now.
const onTabDetached = (tabId, detachInfo) => {
    logInWindowContext(detachInfo.oldWindowId, 'Detached', tabId);

    if (isWindowLocked(detachInfo.oldWindowId)) {
        // Don't do anything while there is still a lock on the window.
        return;
    }
    else if (detachInfo.oldPosition <= activeTabIndex[detachInfo.oldWindowId]) {
        activeTabIndex[detachInfo.oldWindowId]--;
        logIndex(detachInfo.oldWindowId);
    }
};

// When a tab has been moved from or to a position before the currently active tab (exclusive or),
// increment or decrement the tracked index accordingly since now there's one more or one tab less.
const onTabMoved = (tabId, moveInfo) => {
    logInWindowContext(moveInfo.windowId, 'Moved', tabId);

    if (isWindowLocked(moveInfo.windowId)) {
        // Don't do anything while there is still a lock on the window.
        return;
    }
    else if (activeTabId[moveInfo.windowId] === tabId) {
        // Moving active tab, just update its tracking index.
        // Note: when moving tabs manually, the moved tabs become active, therefore only this
        // branch of code is expected to be executed. The other two `else if` parts are supposed
        // to handle tabs moved programmatically, but they're not tested.
        activeTabIndex[moveInfo.windowId] = moveInfo.toIndex;
        logIndex(moveInfo.windowId);
    }
};

// Move newly open tab to be one to the right of the opener tab, if not already at that position.
// Also if the position of the new tab is before the currently active one, incerment the tracked
// index by one since there's one more tab now.
const onTabCreated = (newTab) => {
    logInWindowContext(newTab.windowId, 'Created', newTab.id);

    if (isWindowLocked(newTab.windowId)) {
        // If tab has been created in a window still having a lock on it, delay the lock release.
        refreshWindowLock(newTab.windowId);
        return;
    }
    else if (newTab.openerTabId) {
        // If a tab has been opened from another tab, move it after the opener tab (if not already
        // at that position, need to query opener tab in order to find out).
        browser.tabs
            .get(newTab.openerTabId)
            .then(
                (openerTab) => {
                    if (newTab.index - openerTab.index !== 1) {
                        browser.tabs
                            .move(newTab.id, {index: openerTab.index + 1})
                            .then(() => {}, error);
                    }
                    if ( ! newTab.active) {
                        refreshActiveTab(newTab.windowId);
                    }
                },
                error
            );
    }
    else if (newTab.windowId in activeTabIndex && newTab.index - activeTabIndex[newTab.windowId] !== 1) {
        // Move 'independent' tabs, such as search results, after the currently active tab (if not
        // already at that position). Except for the case when we don't know the active tab index,
        // although that should be just an edge case.
        browser.tabs
            .move(newTab.id, {index: activeTabIndex[newTab.windowId] + 1})
            .then(() => {}, error);
    }
};

// Make active tab to be one to the left of the closed tab, if it had focus.
const onTabRemoved = (tabId, removeInfo) => {
    logInWindowContext(removeInfo.windowId, 'Removed', tabId);

    if (removeInfo.isWindowClosing) {
        // No point in doing anything if the whole window is going to close.
        return;
    }
    else if (isWindowLocked(removeInfo.windowId)) {
        // Also don't do anything while there is still a lock on the window.
        return;
    }

    onActivatedLock[removeInfo.windowId] = true;
    logInWindowContext(removeInfo.windowId, 'current index', activeTabIndex[removeInfo.windowId]);

    if (tabId === activeTabId[removeInfo.windowId] && activeTabIndex[removeInfo.windowId] > 0) {
        // Closing active tab and there are some more on the left.
        logInWindowContext(removeInfo.windowId, 'query tab at', activeTabIndex[removeInfo.windowId] - 1);
        browser.tabs
            .query({windowId: removeInfo.windowId, index: activeTabIndex[removeInfo.windowId] - 1})
            .then(
                (tabs) => {
                    assertSingleTab(tabs, (tab) => {
                        logInWindowContext(tab.windowId, 'activate tab', tab.id, 'at', tab.index);
                        browser.tabs
                            .update(tab.id, {active: true})
                            .then(trackActiveTab, error);
                    });
                },
                error
            );
    }
    else {
        // Closing first or non-active tab.
        refreshActiveTab(removeInfo.windowId);
    }
};

// Function to add event listeners to `browser.tabs` events.
const init = () => {
    try {
        // Add event listeners.
        browser.windows.onCreated.addListener(onWindowOpen);
        browser.tabs.onActivated.addListener(onTabActivated);
        browser.tabs.onAttached.addListener(onTabAttached);
        browser.tabs.onDetached.addListener(onTabDetached);
        browser.tabs.onMoved.addListener(onTabMoved);
        browser.tabs.onCreated.addListener(onTabCreated);
        browser.tabs.onRemoved.addListener(onTabRemoved);

        // Set initial values on extension load.
        browser.tabs
            .query({currentWindow: true, active: true})
            .then(
                (tabs) => assertSingleTab(tabs, trackActiveTab),
                error
            );

        debug('☀️ Initialized');
        initialized = true;
    } catch (e) {
        error(e);
    }
};

// Function to remove event listeners, effectively disabling the add-on.
const deinit = () => {
    try {
        // Remove envent listeners.
        browser.windows.onCreated.removeListener(onWindowOpen);
        browser.tabs.onActivated.removeListener(onTabActivated);
        browser.tabs.onAttached.removeListener(onTabAttached);
        browser.tabs.onDetached.removeListener(onTabDetached);
        browser.tabs.onMoved.removeListener(onTabMoved);
        browser.tabs.onCreated.removeListener(onTabCreated);
        browser.tabs.onRemoved.removeListener(onTabRemoved);

        // Remove tabs state.
        activeTabId = {};
        activeTabIndex = {};
        onActivatedLock = {};

        debug('🌙 Deinitialized');
        initialized = false;
    } catch (e) {
        error(e);
    }
};

// Function to listen to `toggle` command, to enable or disable the add-on using a keyboard shortcut.
browser.commands.onCommand.addListener((command) => {
    if (command === 'toggle') {
        if (initialized) {
            deinit();
        } else {
            init();
        }
    }
});

init();
