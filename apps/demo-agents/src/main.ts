#!/usr/bin/env node
import { parseTask, scaffoldMessage } from './cli.js';

console.log(scaffoldMessage(parseTask(process.argv.slice(2))));
