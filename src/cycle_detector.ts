import { Tool } from './tool';
import * as blessed from 'blessed';
import { rateLimit } from './rate_limit';

const Box: new (opts: blessed.Widgets.BoxOptions) => blessed.Widgets.BoxElement = require('blessed/lib/widgets/box');

export class CycleDetector extends Box {
  tools?: Tool[];

  constructor(private opts?: blessed.Widgets.BoxOptions) {
    super(
      Object.assign(
        {
          top: 0,
          width: '100%',
          height: 1,
        },
        opts,
      ) as blessed.Widgets.BoxOptions,
    );
    this.hide();
    this.renderCycles = rateLimit(this.renderCycles.bind(this), 100);
  }

  setTools(tools: Tool[]) {
    this.tools = tools;
    this.renderCycles();
  }

  renderCycles() {
    if (this.tools == null) {
      return;
    }

    // Work backward (right to left), for each tool see if its selected item was also selected
    // by an earlier (leftward) tool, and if so draw an arrow pointing back to that tool to
    // signify the cycle, to save a developer accidentally going through an endless loop at 3am.
    let hasCycles = false;
    const cycleXs: number[][] = [];
    for (let i = this.tools.length - 1; i >= 1; i--) {
      const curr = this.tools[i];
      if (curr.selectedItem == null) {
        continue;
      }
      for (let j = i - 1; j >= 0; j--) {
        const prev = this.tools[j];
        if (curr.selectedItem === prev.selectedItem) {
          hasCycles = true;
          cycleXs.push([
            (prev.left as number) + Math.floor((prev.width as number) / 2),
            (curr.left as number) + Math.floor((curr.width as number) / 2),
          ]);
        }
      }
    }
    for (const child of this.children.slice()) {
      this.remove(child);
      child.destroy();
    }
    if (hasCycles) {
      this.append(
        blessed.text({
          top: 0,
          left: 0,
          width: 'shrink',
          height: 1,
          style: {
            bg: 'red',
            fg: 'black',
          },
          content: ' c y c l e ',
        }),
      );

      for (const [x1, x2] of cycleXs) {
        this.append(
          blessed.text({
            top: 0,
            left: x1,
            width: x2 - x1,
            height: 1,
            style: {
              fg: 'red',
            },
            content: '╔' + '═'.repeat(x2 - x1 - 2) + '╗',
          }),
        );
      }
      this.show();
    } else {
      this.hide();
    }

    this.screen.render();
  }
}
