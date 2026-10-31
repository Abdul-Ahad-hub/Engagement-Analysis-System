import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
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
        let servername: string | undefined;
        try {
          servername = new URL(url).hostname;
        } catch {
          servername = undefined;
        }
        return {
          type: 'postgres',
          url,
          ssl: { rejectUnauthorized: false, ...(servername ? { servername } : {}) }, // required by Neon SNI
          entities: [EngagementRecord, EngagementSession],
          synchronize: config.get<string>('NODE_ENV') !== 'production',
        };
      },
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
