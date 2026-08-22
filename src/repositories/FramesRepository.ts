import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EngagementRecord } from '../entities/EngagementRecord';
import { IFramesRepository } from '../interfaces/repository/IFramesRepository';
import { PersistenceException } from '../common/exceptions/Exceptions';

@Injectable()
export class FramesRepository implements IFramesRepository {
  constructor(
    @InjectRepository(EngagementRecord)
    private readonly ormRepository: Repository<EngagementRecord>,
  ) {}

  async createMany(records: Partial<EngagementRecord>[]): Promise<EngagementRecord[]> {
    try {
      const entities = this.ormRepository.create(records);
      return await this.ormRepository.save(entities);
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

  async findBySessionId(sessionId: string): Promise<EngagementRecord[]> {
    try {
      return await this.ormRepository.find({
        where: { sessionId },
        order: { createdAt: 'ASC' },
      });
    } catch (err) {
      throw new PersistenceException({ operation: 'findBySessionId', cause: (err as Error).message });
    }
  }
}