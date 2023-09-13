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
  private footerText?: blessed.Widgets.TextElement;
  private rootNode: contrib.Widgets.TreeNode = { extended: true, children: {} };
  private invalidateTimer?: unknown;

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
    this.invalidate();
  }

  handleFileSelected(file: File) {
    this.footerText!.setContent(file.path + ' [' + file.chunk + ']');
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
    this.footerText = blessed.text({
      bottom: 0,
    });
    screen.append(this.footerText);

    // Tree
    this.tree = contrib.tree({
      height: '100%-2',
    });

    this.tree.on('select', ({ file }: { file: File }) => this.handleFileSelected(file));
    this.tree.setData(this.rootNode);
    this.tree.focus();
    screen.append(this.tree);

    // Render and start requesting sourcemap data
    screen.render();
    sourcemapFs(this.path, this);
  }
}

function rerender(tree: contrib.Widgets.TreeElement) {
  tree.setData(tree.data);
  tree.screen.render();
}
