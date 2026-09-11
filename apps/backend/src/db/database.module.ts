import { Module } from '@nestjs/common';
import { DatabaseClient } from './database.client.js';

@Module({
  providers: [DatabaseClient],
  exports: [DatabaseClient],
})
export class DatabaseModule {}
