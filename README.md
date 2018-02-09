Tab Control
===========

A very simplistic add-on for Firefox to position new tabs to the right of the current tab and
activate the tab to the left when closing the current tab.

Easy to use, no need to configure anything.

No permissions required.

Inspired by the old [Tab Control][original] add-on by Angly Cat that is not supported by Firefox
anymore. This new add-on is built using Web-Extensions API that is supported by the most of the
modern browsers, but it might be irrelevant for other browsers or not even work.

 [original]: https://addons.mozilla.org/firefox/addon/tab-control/

Known issues
------------

 * The `browser.tabs.insertRelatedAfterCurrent` and `browser.tabs.selectOwnerOnClose` settings have
   no effect when the add-on is enabled. If `browser.tabs.insertRelatedAfterCurrent` is set to
   `false` (non-default value), new related tabs may briefly appear at the end before being moved
   to the correct location. Also the tab, that would have normally been activated when the current
   tab is closed, may be activated briefly before the add-on activates the correct tab. I believe
   these effects are results of the Web-Extensions API limitations.
 * The add-on may behave unexpectedly when used with any other add-on that moves tabs around on tab
   open and close events.
 * Firefox makes tabs that are being manipulated manually active automatically. The tabs might be
   also opened, closed, moved (including between windows) programmatically by other add-ons and user
   scripts. Such interactions are considered in the implementation, but were not tested extensively.

Are there any alternatives?
---------------------------

Yes, there are:

 * [Tab Open/Close Control][tab-open-close-control] by F. Kolbe, that includes a lot of options,
   but sadly activating tab to the left on close was not working properly and the author hasn't
   released any updates for several of months, which has prompted me to write this add-on.
 * [Open Tabs Next to Current][open-tabs-next-to-current] by Sebastian Blask, that does exactly
   what it says in its name. Shame I haven't discovered his add-on before I went to lengths to
   implement my own.
 * [Focus On Left Tab After Closing][focus-on-left-tab-after-closing] by e10s, that I have not
   tested yet, but it could work in conjunction with the previous add-on.

 [tab-open-close-control]: https://addons.mozilla.org/cs/firefox/addon/tab-open-close-control/
 [open-tabs-next-to-current]: https://addons.mozilla.org/cs/firefox/addon/open-tabs-next-to-current/
 [focus-on-left-tab-after-closing]: https://addons.mozilla.org/cs/firefox/addon/focus-on-left-tab-aft-closing/

License
-------

This add-on is released under the MIT License. See LICENSE.md for details.
