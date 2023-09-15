import * as blessed from 'blessed';
import * as contrib from 'blessed-contrib';
import { sourcemapFs } from './sourcemap_fs';

export interface File {
  path: string;
  chunks: string[];
  bytes: number;
}

interface Node extends contrib.Widgets.TreeNode {
  file?: File;
  chunks?: { [P: string]: number };
  children?: { [P: string]: Node };
  parent?: Node;
}

export class Ui {
  private tree?: contrib.Widgets.TreeElement;
  private footerText?: blessed.Widgets.TextElement;
  private gauge?: contrib.Widgets.GaugeElement;
  private chunkTable?: contrib.Widgets.TableElement;
  private rootNode: Node = { extended: true, children: {}, chunks: {} };
  private invalidateTimer?: unknown;

  constructor(private path: string) {}

  addFiles(...files: File[]) {
    for (const file of files) {
      const parts = file.path.split('/');
      let node = this.rootNode;
      for (const part of parts) {
        if (node.children == null || node.children[part] == null) {
          (node.children ??= {})[part] = { parent: node };
        }
        node = node.children![part];
      }
      if (node.file != null) {
        // We have found a 2nd piece of this file in a different chunk
        node.file.chunks.push(...file.chunks);
      } else {
        node.file = file;
      }

      // Propagate the chunks associated with this file up the dir tree
      let parentNode: Node | undefined = node;
      while (parentNode != null) {
        parentNode.chunks ??= {};
        for (const chunk of file.chunks) {
          if (parentNode.chunks[chunk] != null) {
            parentNode.chunks[chunk] += 1;
          } else {
            parentNode.chunks[chunk] = 1;
          }
        }
        parentNode = parentNode.parent;
      }
    }
    this.invalidate();
  }

  handleNodeSelected(node: Node) {
    /*if(node.file) {
      this.footerText!.setContent(node.file.path + ' [' + node.file.chunks.join(',') + ']');
    } else {
      this.footerText!.setContent('');
    }*/

    if (node.chunks != null) {
      // Set gauge
      const values = Array.from(Object.values(node.chunks));
      const sum = values.reduce((prev, next) => prev + next, 0);
      const chunkPcts = Array.from(Object.entries(node.chunks))
        .map(([chunk, count]) => [chunk, count / sum])
        .sort((a, b) => b[1] - a[1]);

      this.gauge!.show();
      splendidlySetData(
        this.gauge!,
        chunkPcts.map(([chunk, pct]) => pct),
      );

      // Set chunk ktable
      this.chunkTable!.show();
      this.chunkTable?.setData({
        headers: ['Chunk', 'Pct'],
        data: chunkPcts.map(([chunk, pct]) => [chunk, pct * 100]),
      });
    } else {
      this.gauge!.hide();
      this.chunkTable!.hide();
    }

    this.invalidate();
  }

  invalidate() {
    if (this.invalidateTimer != null) {
      return;
    }

    this.invalidateTimer = setTimeout(() => {
      this.rerender();
      this.invalidateTimer = undefined;
    }, 16);
  }

  rerender() {
    if (this.tree != null) {
      rerender(this.tree);
    }
  }

  render() {
    const screen = blessed.screen({ smartCSR: true });

    screen.key(['escape', 'q', 'C-c'], function (ch, key) {
      return process.exit(0);
    });

    // Footer text
    /*this.footerText = blessed.text({
      bottom: 0,
      height: 10
    });
    screen.append(this.footerText);*/

    // Tree Box
    const treeBox = blessed.box({
      top: 0,
      left: 0,
      width: 50,
      height: '100%',
      border: {
        type: 'line',
      },
    });
    screen.append(treeBox);
    // Tree
    this.tree = contrib.tree({
      top: 1,
      left: 1,
      width: 48,
      height: process.stdout.rows - 2,
    });
    treeBox.append(this.tree);

    this.tree.rows.on('select item', (e: any) => {
      var selectedNode = this.tree!.nodeLines[this.tree!.rows.getItemIndex(this.tree!.rows.selected)];
      this.handleNodeSelected(selectedNode);
    });
    this.tree.key(['z'], () => {
      this.chunkTable!.focus();
    });
    this.tree.setData(this.rootNode);
    this.tree.focus();
    screen.append(this.tree);

    // Chunk box
    const chunkBox = blessed.box({
      top: 0,
      left: 51,
      border: {
        type: 'line',
      },
    });
    screen.append(chunkBox);

    // Chunk gauge
    this.gauge = contrib.gauge({
      label: 'Chunk composition',
      percent: [100],
    });
    chunkBox.append(this.gauge);
    this.gauge!.hide();

    // Chunk table
    this.chunkTable = contrib.table({
      top: 7,
      left: 1,
      keys: true,
      mouse: true,
      columnSpacing: 5,
      columnWidth: [30, 10],
    });
    this.chunkTable.key(['z'], () => this.tree!.focus());
    chunkBox.append(this.chunkTable);
    this.chunkTable!.hide();

    // Render and start requesting sourcemap data
    screen.render();
    sourcemapFs(this.path, this);
  }
}

function rerender(tree: contrib.Widgets.TreeElement) {
  tree.setData(tree.data);
  tree.screen.render();
}

/**
 * Shows a large number of data without breaking the gauge if we have many small percentages.
 * @param gauge
 * @param data Each item should be in the range 0 to 1 and add up to 1 total.
 * @param gaugeWidth Number of columns the gauge is allocated
 */
function splendidlySetData(gauge: contrib.Widgets.GaugeElement, data: number[], gaugeWidth: number) {
  // data should add up to 1, should be sorted with largest percentages first.
  const showData: number[] = [];
  let width = 0;
  let thisWidth = 0;
  for (const datum of data) {
    let rounded = datum;
    if (rounded >= 0.01) {
      rounded = Math.floor(rounded * 100) / 100;
    } else if (rounded >= 0.001) {
      rounded = Math.floor(rounded * 1000) / 1000;
    } else if (rounded >= 0.0001) {
      rounded = Math.floor(rounded * 10000) / 10000;
    } else if (rounded >= 0.00001) {
      rounded = Math.floor(rounded * 100000) / 100000;
    }
    thisWidth = rounded * (gauge.canvasSize.width - 3);

    if (width + thisWidth > gauge.canvasSize.width - 3) {
      // do not decrease this any further otherwise 50/50splits will only shwo the first half
      break;
    }

    width += thisWidth;
    showData.push(rounded);
  }
  if (showData.length && width - thisWidth + showData[showData.length - 1].toString().length > gauge.canvasSize.width - 3) {
    showData.pop();
  }

  gauge.setData(showData);
}
