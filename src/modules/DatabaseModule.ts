import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as pg from 'pg';
import { EngagementRecord } from '../entities/EngagementRecord';
import { EngagementSession } from '../entities/EngagementSession';

/**
 * Owns the Neon (Postgres) connection. Kept separate from AppModule so the
 * DB wiring is independently testable/swappable, and so AppModule reads as
 * pure composition rather than also holding connection config.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('DATABASE_URL') ?? '';
        if (!url) {
          // Let the API boot for health checks and configuration diagnosis. DB-backed
          // operations will still require DATABASE_URL and an initialized connection.
          console.warn('DATABASE_URL is not configured; starting without a database connection.');
        }
        let servername: string | undefined;
        try {
          servername = new URL(url).hostname;
        } catch {
          servername = undefined;
        }
        return {
          type: 'postgres',
          driver: pg,
          url,
          manualInitialization: !url,
          ssl: { rejectUnauthorized: false, ...(servername ? { servername } : {}) },
          entities: [EngagementRecord, EngagementSession],
          synchronize: false,
          extra: {
            max: 1,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
