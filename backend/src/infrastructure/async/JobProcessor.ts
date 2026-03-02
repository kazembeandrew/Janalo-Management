// Infrastructure Layer - Async Processing
// Async job processing for complex operations

export interface Job<T = any> {
  id: string;
  type: string;
  data: T;
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  progress?: number; // 0-100
  userId?: string;
}

export interface JobHandler<T = any, R = any> {
  canHandle(jobType: string): boolean;
  process(job: Job<T>): Promise<R>;
}

export class AsyncJobProcessor {
  private handlers = new Map<string, JobHandler>();
  private queue: Job[] = [];
  private processing = new Set<string>();
  private maxConcurrency = 3;
  private isRunning = false;

  registerHandler(handler: JobHandler): void {
    // Handlers register themselves based on their canHandle method
    console.log(`📋 Registered job handler: ${handler.constructor.name}`);
  }

  registerHandlerForType(jobType: string, handler: JobHandler): void {
    this.handlers.set(jobType, handler);
  }

  async enqueue<T>(
    type: string,
    data: T,
    options: {
      priority?: 'low' | 'medium' | 'high';
      userId?: string;
    } = {}
  ): Promise<string> {
    const job: Job<T> = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      priority: options.priority || 'medium',
      createdAt: new Date(),
      status: 'pending',
      userId: options.userId
    };

    // Insert based on priority (high priority jobs go to front)
    if (job.priority === 'high') {
      this.queue.unshift(job);
    } else if (job.priority === 'low') {
      this.queue.push(job);
    } else {
      // Medium priority - insert after high priority jobs
      const highPriorityCount = this.queue.filter(j => j.priority === 'high').length;
      this.queue.splice(highPriorityCount, 0, job);
    }

    console.log(`📋 Enqueued job ${job.id} of type ${type} with priority ${job.priority}`);

    // Start processing if not already running
    if (!this.isRunning) {
      this.startProcessing();
    }

    return job.id;
  }

  async getJobStatus(jobId: string): Promise<Job | null> {
    // Check active jobs
    for (const job of this.queue) {
      if (job.id === jobId) return job;
    }

    // In a real system, you'd check a persistent store for completed jobs
    return null;
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const index = this.queue.findIndex(job => job.id === jobId);
    if (index !== -1 && !this.processing.has(jobId)) {
      this.queue.splice(index, 1);
      console.log(`❌ Cancelled job ${jobId}`);
      return true;
    }
    return false;
  }

  getQueueStats(): {
    pending: number;
    processing: number;
    total: number;
    handlers: string[];
  } {
    return {
      pending: this.queue.length,
      processing: this.processing.size,
      total: this.queue.length + this.processing.size,
      handlers: Array.from(this.handlers.keys())
    };
  }

  private async startProcessing(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log('🚀 Started async job processor');

    while (this.isRunning) {
      // Check if we can process more jobs
      if (this.processing.size >= this.maxConcurrency || this.queue.length === 0) {
        await this.sleep(1000); // Wait 1 second before checking again
        continue;
      }

      // Get next job
      const job = this.queue.shift();
      if (!job) continue;

      // Start processing
      this.processing.add(job.id);
      job.status = 'processing';
      job.startedAt = new Date();

      console.log(`⚙️ Processing job ${job.id} of type ${job.type}`);

      // Process job asynchronously
      this.processJob(job).catch(error => {
        console.error(`❌ Job ${job.id} failed:`, error);
        job.status = 'failed';
        job.error = error.message;
        job.completedAt = new Date();
        this.processing.delete(job.id);
      });
    }
  }

  private async processJob(job: Job): Promise<void> {
    try {
      const handler = this.handlers.get(job.type);
      if (!handler) {
        throw new Error(`No handler registered for job type: ${job.type}`);
      }

      // Update progress
      job.progress = 10;

      // Process the job
      const result = await handler.process(job);

      // Mark as completed
      job.status = 'completed';
      job.result = result;
      job.progress = 100;
      job.completedAt = new Date();

      console.log(`✅ Completed job ${job.id}`);

    } catch (error: any) {
      job.status = 'failed';
      job.error = error.message;
      throw error;
    } finally {
      this.processing.delete(job.id);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stop(): void {
    this.isRunning = false;
    console.log('🛑 Stopped async job processor');
  }
}

// Job handlers for accounting operations
export class ReportGenerationHandler implements JobHandler {
  constructor(
    private accountingService: any, // Would inject the actual service
    private cacheService: any
  ) {}

  canHandle(jobType: string): boolean {
    return ['trial_balance', 'income_statement', 'balance_sheet'].includes(jobType);
  }

  async process(job: Job): Promise<any> {
    const { reportType, parameters, userId } = job.data;

    job.progress = 25;

    let reportData: any;

    switch (reportType) {
      case 'trial_balance':
        reportData = await this.accountingService.generateTrialBalance(new Date(parameters.asOfDate));
        break;
      case 'income_statement':
        reportData = await this.generateIncomeStatement(parameters);
        break;
      case 'balance_sheet':
        reportData = await this.generateBalanceSheet(parameters);
        break;
      default:
        throw new Error(`Unknown report type: ${reportType}`);
    }

    job.progress = 75;

    // Cache the result
    await this.cacheService.setCachedReport(reportType, parameters, reportData);

    job.progress = 90;

    return {
      reportType,
      parameters,
      data: reportData,
      generatedAt: new Date().toISOString(),
      generatedBy: userId
    };
  }

  private async generateIncomeStatement(parameters: any): Promise<any> {
    // Implementation for income statement
    // Calculate revenues, expenses, gross profit, net income
    return {
      revenues: [],
      expenses: [],
      grossProfit: 0,
      netIncome: 0,
      period: parameters.period
    };
  }

  private async generateBalanceSheet(parameters: any): Promise<any> {
    // Implementation for balance sheet
    // Calculate assets, liabilities, equity
    return {
      assets: { current: [], fixed: [] },
      liabilities: { current: [], longTerm: [] },
      equity: [],
      period: parameters.period
    };
  }
}

// Singleton instance for the application
export const jobProcessor = new AsyncJobProcessor();

// Initialize with handlers
export function initializeJobProcessor(
  accountingService: any,
  cacheService: any
): void {
  const reportHandler = new ReportGenerationHandler(accountingService, cacheService);
  jobProcessor.registerHandler(reportHandler);

  // Register specific job types
  jobProcessor.registerHandlerForType('trial_balance', reportHandler);
  jobProcessor.registerHandlerForType('income_statement', reportHandler);
  jobProcessor.registerHandlerForType('balance_sheet', reportHandler);
}
