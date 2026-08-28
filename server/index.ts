#!/usr/bin/env node
import { Option, program } from 'commander';

import { pull } from './pull';
import { start } from './start';

program
  .command('pull')
  .description('Download the latest Scryfall bulk data export')
  .argument('<directory>', 'Directory to download the bulk data export into')
  .addOption(new Option('--force', 'Download even if the file already exists'))
  .addOption(new Option('--progress', 'Show a download progress bar'))
  .action(pull);

program
  .command('server')
  .description('Start the card lookup server from a local bulk data index')
  .argument('<directory>', 'Directory holding the pulled bulk data export')
  .addOption(new Option('--host <address>').default('127.0.0.1').env('HOST'))
  .addOption(new Option('--port <number>').default('3333').env('PORT'))
  .action(start);

await program.parseAsync();
