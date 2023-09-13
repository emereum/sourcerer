import * as blessed from 'blessed';
import * as contrib from 'blessed-contrib';
import { sourcemapFs } from './sourcemap_fs';

export interface File {
  path: string;
  chunk: string;
  bytes: number;
}

export class Ui {
  private tree?: contrib.Widgets.TreeElement;
  private rootNode: contrib.Widgets.TreeNode = { extended: true, children: {} };
  private invalidateTimer?: number;

  constructor(private path: string) {}

  addFiles(...files: File[]) {
    for (const file of files) {
      const parts = file.path.split('/');
      let node = this.rootNode;
      for (const part of parts) {
        if (node.children == null || node.children[part] == null) {
          (node.children ??= {})[part] = {};
        }
        node = node.children![part];
        node.file = file;
      }
    }
  }

  invalidate() {
    if (this.invalidateTimer != null) {
      return;
    }

    setTimeout(() => this.rerender(), 16);
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
    this.tree = contrib.tree();
    this.tree.setData(this.rootNode);
    this.tree.focus();
    screen.append(this.tree);
    screen.render();

    sourcemapFs(this.path, this);
  }
}

function rerender(tree: contrib.Widgets.TreeElement) {
  tree.setData(tree.data);
  tree.screen.render();
}
