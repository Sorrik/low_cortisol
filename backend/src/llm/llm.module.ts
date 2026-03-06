// backend/src/llm/llm.module.ts

import { Module }       from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { LlmService }   from './llm.service'
import { RagModule }    from '../rag/rag.module'

@Module({
  imports:   [ConfigModule, RagModule],
  providers: [LlmService],
  exports:   [LlmService],
})
export class LlmModule {}