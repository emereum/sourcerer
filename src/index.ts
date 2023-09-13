import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';

(async function () {
  if (process.argv.length < 2 || process.argv[1] !== '/snapshot/sourcemap-fs/dist/index.js') {
    console.warn(
      'It looks like you are running sourcemap-fs using the node runtime directly. ' +
        'This product can also be built as a binary by following the instructions in the readme.',
    );
  }

  await yargs(hideBin(process.argv))
    .command(
      '$0 <arg1>',
      'Does the thing.',
      (yargs) =>
        yargs
          .positional('arg1', {
            describe: 'The thing to do',
            demandOption: true,
            type: 'string',
          })
          .option('opt1', {
            alias: 'o',
            default: 'Some Default',
            describe: 'Another thing, this time optional.',
            type: 'string',
          })
          .example('$0 foo', 'Do the foo thing.')
          .strict(true)
          .wrap(Math.min(process.stdout.columns ?? 80, 115))
          .help(),
      (argv) => {
        console.dir({ argv });
      },
    )
    .parse();
})();
