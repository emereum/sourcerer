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
          keys: ['right', 'enter', 'space'],
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