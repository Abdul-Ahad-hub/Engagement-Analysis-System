import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Domain-agnostic summary of one capture session. */
@Entity('engagement_sessions')
export class EngagementSession {
  /** UUID stamped on every window of the capture session. */
  @PrimaryColumn('uuid')
  sessionId!: string;

  @Column({ type: 'varchar', nullable: true })
  endReason!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamptz' })
  savedAt!: Date;

  @Column({ type: 'int', default: 0 })
  framesCaptured!: number;

  @Column({ type: 'int', default: 0 })
  framesWithFace!: number;

  @Column({ type: 'int', default: 0 })
  framesCenterCrop!: number;

  @Column({ type: 'float', default: 0 })
  avgFrameMs!: number;

  @Column({ type: 'float', default: 0 })
  maxFrameMs!: number;

  @Column({ type: 'int', default: 0 })
  windowsSent!: number;

  @Column({ type: 'int', default: 0 })
  windowsUnsent!: number;

  @Column({ type: 'varchar', nullable: true })
  mode!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  routing!: Record<string, unknown> | null;

  /** Windows stored in engagement_records for this session. */
  @Column({ type: 'int', default: 0 })
  windowsStored!: number;

  /** Windows where the model actually ran (status = inferred). */
  @Column({ type: 'int', default: 0 })
  windowsInferred!: number;

  /** Mean engagementScore over inferred windows; null if none. */
  @Column({ type: 'float', nullable: true })
  avgEngagementScore!: number | null;

  /** Most frequent label over inferred windows; null if none. */
  @Column({ type: 'varchar', nullable: true })
  dominantLabel!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
