import * as contrib from 'blessed-contrib';
import type { FilteredDataset, Module } from './sourcemap_fs';
import type { Tool } from './tool';
import { ToolChooser, Tools } from './tool_chooser';
import { rateLimit } from './rate_limit';
import { intersect } from './intersect';

const Tree: new (opts: contrib.Widgets.TreeOptions) => contrib.widget.Tree = require('blessed-contrib/lib/widget/tree');

interface Node extends contrib.Widgets.TreeNode {
  module?: Module;
  children?: { [P: string]: Node };
  parent?: Node;
}

/**
 * Given a current graph kind (if any), presents a UI that allows users to choose
 * another graph to navigate. For example if the user has just picked a module,
 * we should let them choose to see the chunk graph (i.e. all chunks that contain the module),
 * or the symbol graph (i.e. all symbols within the module).
 */
export class ModuleBrowser extends Tree implements Tool {
  selectedItem?: unknown;
  private dataset?: FilteredDataset;
  constructor(private opts?: contrib.Widgets.TreeOptions) {
    super(
      Object.assign(
        {
          label: 'modules',
          top: 0,
          width: 30,
          height: '100%',
          border: { type: 'line', fg: 'magenta' },
          template: {
            lines: true,
          },
          keys: ['right', 'enter', 'space'],
        },
        opts,
      ) as contrib.Widgets.TreeOptions,
    );

    this.renderDataset = rateLimit(this.renderDataset.bind(this), 500);

    this.on('select', (node: Node) => {
      this.selectedItem = node.module;
      this.emit('select item', this.selectedItem);
    });

    this.rows.key(['right', 'enter', 'space'], () => {
      const { module } = this.nodeLines![this.rows.getItemIndex(this.rows.selected)] as unknown as Node;

      if (module == null || this.dataset == null) {
        // assume we are trying to drill down
        this.rows.down();
        this.screen.render();
        return;
      }

      const toolChooser = new ToolChooser();
      this.emit('proceed', toolChooser);
      toolChooser.setDataset({
        modules: [module],
        chunks: intersect(module.chunks, this.dataset.chunks),
        symbols: [module.symbols],
        loaded: true,
      });
      toolChooser.setParentTool(Tools.ModuleBrowser);
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

    const { modules } = this.dataset;
    const rootNode: Node = { extended: true, children: {}, chunks: {} };

    for (const module of modules) {
      const parts = module.path.split('/');
      let node = rootNode;
      for (const part of parts) {
        if (node.children == null || node.children[part] == null) {
          (node.children ??= {})[part] = { parent: node };
        }
        node = node.children![part];
      }
      if (node.module != null) {
        // We have found a 2nd piece of this module in a different chunk
        node.chunks.push(...module.chunks);
      } else {
        node.module = module;
        node.chunks = module.chunks.slice();
      }

      // Propagate the chunks associated with this module up the dir tree
      let parentNode: Node | undefined = node;
      while (parentNode != null) {
        parentNode.chunks ??= {};
        for (const chunk of module.chunks) {
          if (parentNode.chunks[chunk.path] != null) {
            parentNode.chunks[chunk.path] += 1;
          } else {
            parentNode.chunks[chunk.path] = 1;
          }
        }
        parentNode = parentNode.parent;
      }
    }
    this.setData(rootNode);
    this.setLabel(`modules (x${modules.length.toLocaleString()})`);
    this.screen.render();
  }
}
