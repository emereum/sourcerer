import * as blessed from 'blessed';
import { ModuleBrowser } from './module_browser';
import { FilteredDataset } from './sourcemap_fs';
import { ChunkBrowser } from './chunk_browser';
import { rateLimit } from './rate_limit';
import { Tool } from './tool';
import { SymbolBrowser } from './symbol_browser';

const Box: new (opts: blessed.Widgets.BoxOptions) => blessed.Widgets.BoxElement = require('blessed/lib/widgets/box');

export enum Tools {
  ChunkBrowser,
  ModuleBrowser,
  SymbolBrowser,
}

interface Button {
  element: blessed.Widgets.BoxElement;
  label: () => string;
  items: () => unknown[] | undefined;
  action: () => void;
}

/**
 * Given a current tool (if any), presents a UI that allows users to choose
 * another tool to navigate. For example if the user has just picked a module,
 * we should let them choose to see the chunk graph (i.e. all chunks that contain the module),
 * or the symbol graph (i.e. all symbols within the module).
 */
export class ToolChooser extends Box implements Tool {
  selectedItem?: unknown;
  private buttons: Button[] = [];
  private selectedButton?: Button;
  private dataset?: FilteredDataset;

  constructor(private opts?: blessed.Widgets.BoxOptions) {
    super(
      Object.assign(
        {
          top: 0,
          width: 30,
          height: '100%',
          border: { type: 'line', fg: 'green' },
        },
        opts,
      ) as blessed.Widgets.BoxOptions,
    );

    this.renderDataset = rateLimit(this.renderDataset.bind(this), 16);

    this.key(['w', 'up'], () => {
      if (this.selectedButton == null) {
        return;
      }

      const i = this.buttons.indexOf(this.selectedButton);
      let j = i - 1;
      if (j < 0) {
        j = this.buttons.length - 1;
      }
      this.select(this.buttons[j]);
    });

    this.key(['s', 'down'], () => {
      if (this.selectedButton == null) {
        return;
      }
      const i = this.buttons.indexOf(this.selectedButton);
      const j = (i + 1) % this.buttons.length;
      this.select(this.buttons[j]);
    });

    this.key(['right', 'enter', 'space'], () => {
      if (this.dataset == null || this.selectedButton == null) {
        return;
      }

      this.selectedButton.action();
    });

    this.key(['left', 'backspace'], () => {
      this.emit('cancel');
    });
  }

  private select(button: Button) {
    if (this.selectedButton != null) {
      this.selectedButton.element.style.border.bg = '';
      this.selectedButton.element.style.bg = '';
    }
    button.element.style.border.bg = 'yellow';
    button.element.style.bg = 'yellow';
    this.selectedButton = button;
    this.screen.render();
  }

  private addButton(opts: { label: () => string; items: () => unknown[] | undefined; action: () => void }) {
    const element = blessed.box({
      top: 0,
      left: 'center',
      width: 24,
      height: 3,
      align: 'center',
      valign: 'middle',
      border: { type: 'line', fg: 'yellow' },
    });
    element.content = opts.label();
    this.append(element);

    this.buttons.push({
      element,
      ...opts,
    });
  }

  setParentTool(parentTool?: Tools) {
    for (const oldButton of this.buttons) {
      this.remove(oldButton.element);
      oldButton.element.destroy();
    }
    this.selectedButton = undefined;
    this.buttons.length = 0;

    if (parentTool !== Tools.ChunkBrowser) {
      this.addButton({
        label: () => `chunks (x${this.dataset?.chunks.length.toLocaleString()})`,
        items: () => this.dataset?.chunks,
        action: () => {
          if (this.dataset == null) {
            return;
          }
          const chunkBrowser = new ChunkBrowser();
          this.emit('proceed', chunkBrowser);
          chunkBrowser.setDataset(this.dataset);
        },
      });
    }

    if (parentTool !== Tools.ModuleBrowser) {
      this.addButton({
        label: () => `modules (x${this.dataset?.modules.length.toLocaleString()})`,
        items: () => this.dataset?.modules,
        action: () => {
          if (this.dataset == null) {
            return;
          }
          const moduleBrowser = new ModuleBrowser();
          this.emit('proceed', moduleBrowser);
          moduleBrowser.setDataset(this.dataset);
        },
      });
    }

    if (parentTool !== Tools.SymbolBrowser) {
      this.addButton({
        label: () => `symbols`,
        items: () => this.dataset?.symbols,
        action: () => {
          if (this.dataset == null) {
            return;
          }
          const symbolBrowser = new SymbolBrowser();
          this.emit('proceed', symbolBrowser);
          symbolBrowser.setDataset(this.dataset);
        },
      });
    }

    switch (this.buttons.length) {
      case 3:
        {
          const offset = Math.ceil((this.height as number) / 8);
          this.buttons[0].element.top = offset;
          this.buttons[1].element.top = offset * 3;
          this.buttons[2].element.top = offset * 5;
        }
        break;
      case 2:
        {
          const offset = Math.ceil((this.height as number) / 6);
          this.buttons[0].element.top = offset;
          this.buttons[1].element.top = offset * 3;
        }
        break;
      default:
        throw new Error('unexpected number of buttons for tool chooser: ' + this.buttons.length);
    }
    this.renderDataset();
  }

  selectInitialButton() {
    // select the first button that has stuff we can view
    for (const button of this.buttons) {
      if (button.items()?.length) {
        this.select(button);
        break;
      }
    }
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

    for (const button of this.buttons) {
      button.element.content = button.label();
    }
    if (this.selectedButton == null) {
      this.selectInitialButton();
    }
    this.screen.render();

    // If there is only a single item available to choose (like a single chunk or single module for example),
    // emit a `select item` event so if there is a cycle with an earlier tool, we detect it early rather than
    // waiting for the user to inevitably select the one option.
    if (this.dataset?.loaded) {
      const buttonsExclSymbols = this.buttons.filter((x) => x.items() !== this.dataset?.symbols);
      const allItems = buttonsExclSymbols.flatMap((x) => x.items());
      if (allItems.length === 1) {
        this.selectedItem = allItems[0];
        this.emit('select item', this.selectedItem);
      }
    }
  }
}
