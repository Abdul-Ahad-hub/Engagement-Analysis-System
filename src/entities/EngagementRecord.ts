import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  Unique,
} from 'typeorm';

/** One analyzed capture window (16 frames, ~10 s) of one capture session. */
@Entity('engagement_records')
@Unique('uq_engagement_records_session_window', ['sessionId', 'windowIndex'])
export class EngagementRecord {
  @PrimaryColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  sessionId!: string;

  @Column({ type: 'int' })
  windowIndex!: number;

  @Column({ type: 'float', nullable: true })
  engagementScore!: number | null;

  @Column({ type: 'varchar' })
  engagementLabel!: string;

  @Column({ type: 'varchar', default: 'inferred' })
  status!: string;

  @Column({ type: 'varchar', nullable: true })
  skipReason!: string | null;

  @Column({ type: 'int', default: 0 })
  framesFilled!: number;

  @Column({ type: 'int', default: 0 })
  faceFrames!: number;

  @Column({ type: 'boolean', default: false })
  partial!: boolean;

  @Column({ type: 'timestamptz' })
  startTime!: Date;

  @Column({ type: 'timestamptz' })
  endTime!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
