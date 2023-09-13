import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { Ui } from './ui';

(async function () {
  if (process.argv.length < 2 || process.argv[1] !== '/snapshot/sourcemap-fs/dist/index.js') {
    console.warn(
      'It looks like you are running sourcemap-fs using the node runtime directly. ' +
        'This product can also be built as a binary by following the instructions in the readme.',
    );
  }

  await yargs(hideBin(process.argv))
    .command(
      '$0',
      'Explores the sourcemaps in the current folder.',
      (yargs) =>
        yargs
          .option('path', {
            describe: 'The path to explore on this disk.',
            default: '.',
            type: 'string',
          })
          .example('$0 .', 'Explore current directory.')
          .strict(true)
          .wrap(Math.min(process.stdout.columns ?? 80, 115))
          .help(),
      (argv) => {
        new Ui(argv.path).render();
      },
    )
    .parse();
})();
