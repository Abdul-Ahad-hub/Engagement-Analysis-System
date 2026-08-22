import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EngagementRecord } from '../entities/EngagementRecord';

/**
 * Owns the Neon (Postgres) connection. Kept separate from AppModule so the
 * DB wiring is independently testable/swappable, and so AppModule reads as
 * pure composition rather than also holding connection config.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        ssl: { rejectUnauthorized: false }, // required by Neon
        entities: [EngagementRecord],
        synchronize: false, // use migrations against a real DB, not auto-sync
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
