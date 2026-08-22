import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('engagement_records')
export class EngagementRecord {
  @PrimaryColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @Index()
  @Column({ type: 'uuid' })
  sessionId!: string;

  @Column({ type: 'float' })
  engagementScore!: number;

  @Column({ type: 'varchar' })
  engagementLabel!: string;

  @Column({ type: 'timestamptz' })
  startTime!: Date;

  @Column({ type: 'timestamptz' })
  endTime!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}