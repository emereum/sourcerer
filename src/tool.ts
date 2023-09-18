import * as blessed from 'blessed';

/** All tools should support cancelling (i.e. "going back up" the swimlane), as well as proceeding through the 'cancel' and 'proceed' events. The swimlane captures left/right arrow key input and calls these on the focussed tool. */
export interface Tool extends blessed.Widgets.BoxElement {
  /**
   * If the user has selected an item, the tool should store that item here.
   * This is used for detecting cycles.
   */
  selectedItem?: unknown;
}
