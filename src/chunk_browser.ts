import { Tool } from './tool';
import * as contrib from 'blessed-contrib';
import * as path from 'path';
import { Chunk, FilteredDataset } from './sourcemap_fs';
import { rateLimit } from './rate_limit';
import { ToolChooser, Tools } from './tool_chooser';
import { intersect } from './intersect';

const Tree: new (opts: contrib.Widgets.TreeOptions) => contrib.widget.Tree = require('blessed-contrib/lib/widget/tree');

interface Node extends contrib.Widgets.TreeNode {
  chunk?: Chunk;
  children?: { [P: string]: Node };
  parent?: Node;
}

export class ChunkBrowser extends Tree implements Tool {
  selectedItem?: unknown;
  private dataset?: FilteredDataset;

  constructor(private opts?: contrib.Widgets.TreeOptions) {
    super(
      Object.assign(
        {
          label: 'chunks',
          top: 0,
          width: 30,
          height: '100%',
          border: { type: 'line', fg: 'cyan' },
          keys: ['right', 'space'],
        },
        opts,
      ) as contrib.Widgets.TreeOptions,
    );

    this.renderDataset = rateLimit(this.renderDataset.bind(this), 500);

    this.on('select', (node: Node) => {
      this.selectedItem = node.chunk;
      this.emit('select item', this.selectedItem);
    });

    this.rows.key(['right', 'enter', 'space'], () => {
      const { chunk } = this.nodeLines![this.rows.getItemIndex(this.rows.selected)] as unknown as Node;

      if (chunk == null || this.dataset == null) {
        return;
      }

      const chooser = new ToolChooser();
      this.emit('proceed', chooser);
      chooser.setDataset({
        modules: intersect(chunk.modules, this.dataset.modules),
        chunks: [chunk],
        symbols: intersect(chunk.symbols, this.dataset.symbols),
        loaded: true,
      });
      chooser.setParentTool(Tools.ChunkBrowser);
    });

    this.rows.key(['left', 'backspace'], () => this.emit('cancel'));
  }

  setDataset(dataset: FilteredDataset) {
    this.dataset = dataset;
    this.renderDataset();
    this.dataset.subscribeProgress?.((pct: number) => this.renderDataset());
  }

  renderDataset() {
    if (this.dataset == null) {
      return;
    }

    const { chunks } = this.dataset;

    // Set gauge
    /*const values = Array.from(Object.values(chunks));
            const sum = values.reduce((prev, next) => prev + next, 0);
            const chunkPcts = Array.from(Object.entries(node.chunks))
              .map(([chunk, count]) => [chunk, count / sum] as const)
              .sort((a, b) => b[1] - a[1]);
      
            this.gauge!.show();
            splendidlySetData(
              this.gauge!,
              chunkPcts.map(([chunk, pct]) => pct),
            );*/

    const rootNode: Node = { extended: true, children: {} };
    for (const chunk of chunks) {
      const name = path.basename(chunk.path, '.js.map') + ` (m${chunk.modules.length.toLocaleString()})`;
      rootNode.children![name] = { chunk };
    }
    this.setData(rootNode);
    this.setLabel(`chunks (x${chunks.length.toLocaleString()})`);
    this.screen.render();
  }
}

/**
 * Shows a large number of data without screwing up the gauge too much if we have many small percentages.
 * @param gauge
 * @param data Each item should be in the range 0 to 1 and add up to 1 total.
 * @param gaugeWidth Number of columns the gauge is allocated
 */
/*function splendidlySetData(gauge: contrib.Widgets.GaugeElement, data: number[]) {
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
  */
