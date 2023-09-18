import * as blessed from 'blessed';
import { ModuleBrowser } from './module_browser';
import { FilteredDataset, Module, loadSourceMappings } from './sourcemap_fs';
import { ChunkBrowser } from './chunk_browser';
import { rateLimit } from './rate_limit';
import { Tool } from './tool';
import { intersect } from './intersect';
import { ToolChooser, Tools } from './tool_chooser';

const Box: new (opts: blessed.Widgets.BoxOptions) => blessed.Widgets.BoxElement = require('blessed/lib/widgets/box');

export class SymbolBrowser extends Box implements Tool {
  selectedItem?: unknown;
  private dataset?: FilteredDataset;
  private search: blessed.Widgets.TextboxElement;
  private nextDataset?: FilteredDataset;
  private resultsBox: blessed.Widgets.BoxElement;

  constructor(private opts?: blessed.Widgets.BoxOptions) {
    super(
      Object.assign(
        {
          label: 'symbols',
          top: 0,
          width: 120,
          height: '100%',
          border: { type: 'line', fg: 'yellow' },
        },
        opts,
      ) as blessed.Widgets.BoxOptions,
    );

    this.renderDataset = rateLimit(this.renderDataset.bind(this), 16);

    const searchContainer = blessed.box({
      label: 'search',
      top: 1,
      width: this.width - 2,
      height: 3,
      border: {
        type: 'line',
        fg: 'yellow',
      },
    });
    this.append(searchContainer);

    this.search = blessed.textbox({
      width: this.width - 4,
      fg: '#111111',
      inputOnFocus: true,
    });
    this.search.setValue('(hit enter to type. use * for wildcard searching)');
    searchContainer.append(this.search);

    this.resultsBox = blessed.box({
      top: 5,
      left: 1,
      width: this.width - 4,
      height: '100%-9',
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      keys: true,
      scrollbar: {
        ch: ' ',
        inverse: true,
      },
    });
    this.append(this.resultsBox);
    this.resultsBox.focus();

    // Focus transitions between result box and search box.
    // When user focuses on search box they are locked into this tool until they hit enter/escape.
    this.search.on('action', () => {
      if (this.search.content.trim().length === 0) {
        return;
      }
      this.performSearch(this.search.content);
      this.resultsBox.focus();
    });

    this.search.key('escape', () => {
      this.resultsBox.focus();
    });

    this.resultsBox.key('enter', () => {
      this.search.style.fg = 'white';
      this.search.setValue(''); // Gotta go fast
      this.search.focus();
      this.screen.render();
    });

    this.resultsBox.key(['right', 'space'], () => {
      if (this.dataset == null || this.nextDataset == null) {
        return;
      }

      const toolChooser = new ToolChooser();
      this.emit('proceed', toolChooser);
      toolChooser.setDataset(this.nextDataset);
      toolChooser.setParentTool(Tools.SymbolBrowser);
    });

    this.resultsBox.key(['left', 'backspace'], () => this.emit('cancel'));

    this.on('focus', () => this.resultsBox.focus());
  }

  async performSearch(search: string) {
    if (this.dataset == null) {
      return;
    }

    // todo: Right now we don't narrow on any sources provided in the filtered dataset,
    // we just go to the modules and grab their sources. we should probably do the former.
    const regex = toSearchRegex(search);
    const modules = this.dataset.modules;

    await loadSourceMappings(this.dataset);

    const foundLines: string[] = [];
    const foundModules: Module[] = [];
    const formattedLines: string[] = [];
    for (const module of modules) {
      if (module.mappings == null) {
        continue;
      }

      // For each mapping in this module, find the earliest column that is mapped from the original source.
      // Sourcemaps only tell us where a line _starts_ being mapped to the output, but not when
      // the line _stops_ being mapped to the output, so we have to assume any symbols from this point
      // onward on a given line are mapped to the output. This does mean we could have false positives....
      const lineMappings: { [P: number]: number } = {};
      for (const mapping of module.mappings) {
        const prev = lineMappings[mapping.originalLine] ?? Number.MAX_SAFE_INTEGER;

        if (mapping.originalColumn < prev) {
          lineMappings[mapping.originalLine] = mapping.originalColumn;
        }
      }

      const lines = module.symbols.split(/(?:\r\n|[\n\v\f\r\x85\u2028\u2029])/);
      let moduleHasMatches = false;
      for (const lineNumber of Object.keys(lineMappings)) {
        const line = lines[Number(lineNumber)];
        if(line == null) {
          // should never happen?
          continue;
        }
        const earliestMappedColumn = lineMappings[lineNumber];
        const matches = Array.from(line.matchAll(regex)).filter((x) => x.index != null && x.index >= earliestMappedColumn);
        if (matches.length) {
          moduleHasMatches = true;
          let formattedLine = `${line}{#111111-fg}${blessed.escape('$')}{/#111111-fg}`;
          for (let i = matches.length - 1; i >= 0; i--) {
            const match = matches[i];
            const index = match.index!;
            formattedLine =
              formattedLine.substring(0, index) +
              '{green-bg}{bold}' +
              formattedLine.substring(index, index + match[0].length) +
              '{/bold}{/green-bg}' +
              formattedLine.substring(index + match[0].length);
          }
          foundLines.push(line);
          formattedLines.push(formattedLine.replace(/( +)/g, '{#111111-fg}•{/#111111-fg}'));
        }
      }
      if (moduleHasMatches) {
        foundModules.push(module);
      }
    }
    if (foundLines.length > 0) {
      this.nextDataset = {
        modules: foundModules,
        chunks: intersect(
          this.dataset.chunks,
          foundModules.flatMap((module) => module.chunks),
        ),
        symbols: foundLines,
        loaded: true,
      };

      const summary =
        `{center}{bold}{#cccccc-bg} symbols (${foundLines
          .map((x) => x.length)
          .reduce((prev, next) => prev + next, 0)
          .toLocaleString()} kB) ` +
        `modules (x${this.nextDataset.modules.length.toLocaleString()}) ` +
        `chunks (x${this.nextDataset.chunks.length.toLocaleString()}) {/#cccccc-bg}{/bold}{/center}\n\n`;
      this.resultsBox.setContent(summary + formattedLines.join('\n'));
    } else {
      this.nextDataset = undefined;
      this.resultsBox.setContent('{#111111-fg}(no matches){/#111111-fg}');
    }
    this.screen.render();
  }

  setDataset(dataset: FilteredDataset) {
    this.dataset = dataset;
    this.renderDataset();
    this.dataset.subscribeProgress?.((pct: number) => this.renderDataset());
    this.resultsBox.focus();
  }

  renderDataset() {
    if (this.dataset == null) {
      return;
    }
    this.screen.render();
  }
}

function toSearchRegex(string) {
  const sanitised = string.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  // We have to implement wildcards as [^ ]* otherwise we'll match from the
  // start of the line, and there are never any symbols mapped at the start of
  // the line (since the code is always tabbed in)
  // alternatively, we could trim leading whitespace of all sourcesContent and
  // rejig all the mappings accordingly...
  const withWildcards = sanitised.replace(/[*]/g, '[a-z0-9_\\$]*');
  return new RegExp(withWildcards, 'ig');
}
