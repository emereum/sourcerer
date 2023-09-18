import * as blessed from 'blessed';
import { sourcemapFs } from './sourcemap_fs';
import { ToolChooser } from './tool_chooser';
import { Swimlane } from './swimlane';
import { CycleDetector } from './cycle_detector';
import { Tool } from './tool';

export class Ui {
  constructor(private path: string) {}

  render() {
    const screen = blessed.screen({ smartCSR: true });
    screen.key(['escape', 'q', 'C-c'], function (ch, key) {
      return process.exit(0);
    });

    const swimlane = new Swimlane();
    screen.append(swimlane);
    screen.render();

    const cycleDetector = new CycleDetector();
    screen.append(cycleDetector);
    swimlane.on('select item', () => cycleDetector.setTools(swimlane.children as Tool[]));
    swimlane.on('append tool', () => cycleDetector.setTools(swimlane.children as Tool[]));
    swimlane.on('remove tool', () => cycleDetector.setTools(swimlane.children as Tool[]));

    const dataset = sourcemapFs(this.path);
    const toolChooser = new ToolChooser();
    swimlane.appendTool(toolChooser);
    toolChooser.setParentTool(undefined);
    toolChooser.setDataset(dataset);
  }
}
