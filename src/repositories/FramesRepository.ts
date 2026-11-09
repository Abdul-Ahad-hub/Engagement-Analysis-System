import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type QueryDeepPartialEntity } from 'typeorm';
import { EngagementRecord } from '../entities/EngagementRecord';
import { EngagementSession } from '../entities/EngagementSession';
import { IFramesRepository } from '../interfaces/repository/IFramesRepository';
import { PersistenceException } from '../common/exceptions/Exceptions';

@Injectable()
export class FramesRepository implements IFramesRepository {
  constructor(
    @InjectRepository(EngagementRecord)
    private readonly ormRepository: Repository<EngagementRecord>,
    @InjectRepository(EngagementSession)
    private readonly sessionRepository: Repository<EngagementSession>,
  ) {}

  async createMany(records: Partial<EngagementRecord>[]): Promise<void> {
    if (records.length === 0) return;
    try {
      await this.ormRepository.upsert(records as QueryDeepPartialEntity<EngagementRecord>[], {
        conflictPaths: ['sessionId', 'windowIndex'],
        skipUpdateIfNoValuesChanged: true,
      });
    } catch (err) {
      throw new PersistenceException({ operation: 'createMany', cause: (err as Error).message });
    }
  }

  async findById(id: string): Promise<EngagementRecord | null> {
    try {
      return await this.ormRepository.findOne({ where: { id } });
    } catch (err) {
      throw new PersistenceException({ operation: 'findById', cause: (err as Error).message });
    }
  }

  async findBySessionWindow(sessionId: string, windowIndex: number): Promise<EngagementRecord | null> {
    try {
      return await this.ormRepository.findOne({ where: { sessionId, windowIndex } });
    } catch (err) {
      throw new PersistenceException({ operation: 'findBySessionWindow', cause: (err as Error).message });
    }
  }

  async findBySessionId(sessionId: string): Promise<EngagementRecord[]> {
    try {
      return await this.ormRepository.find({
        where: { sessionId },
        order: { windowIndex: 'ASC' },
      });
    } catch (err) {
      throw new PersistenceException({ operation: 'findBySessionId', cause: (err as Error).message });
    }
  }

  async upsertSession(session: Partial<EngagementSession>): Promise<EngagementSession> {
    try {
      return await this.sessionRepository.save(this.sessionRepository.create(session));
    } catch (err) {
      throw new PersistenceException({ operation: 'upsertSession', cause: (err as Error).message });
    }
  }

  async findSessionsByUserEmail(userEmail: string, limit: number): Promise<EngagementSession[]> {
    try {
      return await this.sessionRepository.find({
        where: { userEmail },
        order: { savedAt: 'DESC' },
        take: limit,
      });
    } catch (err) {
      throw new PersistenceException({
        operation: 'findSessionsByUserEmail',
        cause: (err as Error).message,
      });
    }
  }

  async findSession(sessionId: string): Promise<EngagementSession | null> {
    try {
      return await this.sessionRepository.findOne({ where: { sessionId } });
    } catch (err) {
      throw new PersistenceException({ operation: 'findSession', cause: (err as Error).message });
    }
  }
}
