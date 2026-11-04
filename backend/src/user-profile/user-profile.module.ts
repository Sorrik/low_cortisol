// backend/src/user-profile/user-profile.module.ts

import { Module }           from '@nestjs/common'
import { TypeOrmModule }    from '@nestjs/typeorm'
import { UserProfile }       from './user-profile.entity'
import { UserProfileService } from './user-profile.service'
import { UserProfileController } from './user-profile.controller'

@Module({
  imports:     [TypeOrmModule.forFeature([UserProfile])],
  providers:   [UserProfileService],
  controllers: [UserProfileController],
  exports:     [UserProfileService],   // ← экспортируем для InsightsService и ML
})
export class UserProfileModule {}


// ─────────────────────────────────────────────────────────────
// Что добавить в app.module.ts:
// ─────────────────────────────────────────────────────────────
//
// import { UserProfileModule } from './user-profile/user-profile.module'
//
// @Module({
//   imports: [
//     ...
//     UserProfileModule,   // ← добавить сюда
//   ],
// })
// export class AppModule {}
//
// ─────────────────────────────────────────────────────────────
// TypeORM autoLoadEntities: true подхватит UserProfile автоматически
// ─────────────────────────────────────────────────────────────