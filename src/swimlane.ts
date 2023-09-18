import * as blessed from 'blessed';
import type { Tool } from './tool';

const Box: new (opts: blessed.Widgets.BoxOptions) => blessed.Widgets.BoxElement = require('blessed/lib/widgets/box');

export class Swimlane extends Box {
  private focussedTool?: Tool;

  constructor(private opts?: blessed.Widgets.BoxOptions) {
    super(
      Object.assign(
        {
          top: 0,
          width: '100%',
          height: '100%',
          border: { type: 'line', fg: 'green' },
        },
        opts,
      ) as blessed.Widgets.BoxOptions,
    );
  }

  appendTool(tool: Tool) {
    tool.left = this.children.length
      ? this.children[this.children.length - 1].left + this.children[this.children.length - 1].width + 1
      : 0;
    tool.height = '100%-2';
    tool.on('proceed', (newTool: Tool) => this.appendTool(newTool));
    tool.on('cancel', () => this.children.length > 1 && this.removeTool(tool));
    tool.on('select item', () => this.emit('select item')); // When a user selects a module or chunk, notify any parent UI
    this.focusTool(tool);
    super.append(tool);
    this.emit('append tool');
  }

  removeTool(tool: Tool) {
    this.remove(tool);
    if (this.children.length) {
      this.focusTool(this.children[this.children.length - 1] as Tool);
    } else {
      this.focusTool(undefined);
    }
    this.emit('remove tool');
    this.screen.render();
  }

  focusTool(tool?: Tool) {
    if (this.focussedTool != null && this.focussedTool.style.border.bg !== '') {
      this.focussedTool.style.border.bg = '';
    }
    if (tool != null) {
      if (tool.style.border.fg !== '') {
        tool.style.border.bg = tool.style.border.fg;
      }

      tool.focus();
    }
    this.focussedTool = tool;
  }
}
