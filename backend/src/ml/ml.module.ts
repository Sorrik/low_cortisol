import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

import { MlService } from './ml.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30_000,
      maxRedirects: 3,
    }),
    ConfigModule,
  ],
  providers: [MlService],
  exports: [MlService],  // ← другие модули смогут инжектить MlService
})
export class MlModule {}
