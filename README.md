Tab Control
===========

A very simplistic add-on for Firefox to position new tabs to the right of the current tab and
activate the tab to the left when closing the current tab.

Inspired by the old [Tab Control add-on by Angly Cat][original] that is not supported by Firefox
anymore. This new add-on is built using Web-Extensions API that is supported by the most of the
modern browsers, but it might be irrelevant for other browsers or not even work.

 [original]: https://addons.mozilla.org/firefox/addon/tab-control/reviews/?src=api

Known issues
------------

 * Unrelated tabs (ie not opened by clicking links on a page) positions are not affected and will
   appear at their default position, probably at the end. It is intentional, but will likely change.
 * The `browser.tabs.insertRelatedAfterCurrent` and `browser.tabs.selectOwnerOnClose` settings have
   no effect when the add-on is enabled. If `browser.tabs.insertRelatedAfterCurrent` is set to
   `false` (non-default value), new related tabs may briefly appear at the end before being moved
   to the correct location. Also the tab, that would have normally been activated when the current
   tab is closed, may be activated briefly before the add-on activates the correct tab. I believe
   these effects are results of the Web-Extensions API limitations.
 * The add-on may behave unexpectedly when used with any other add-on that moves tabs around on tab
   open and close events.
 * Firefox automatically makes tabs that are being manipulated manually active. The tabs might be
   also opened, closed, moved (including between windows) programmatically by other add-ons, but
   compatibility with such interactions was not tested.

License
-------

This add-on is released under the MIT License. See LICENSE.md for details.
