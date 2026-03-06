import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
@Injectable()
export class CacheInvalidationService {
  private readonly logger = new Logger(CacheInvalidationService.name);

  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,
  ) {}

  async invalidate(userId: string): Promise<void> {
    await this.cache.del(`predict:${userId}`);
    await this.cache.del(`train:${userId}`);
    this.logger.log(`[invalidate] кэш сброшен → userId=${userId}`);
  }
}
