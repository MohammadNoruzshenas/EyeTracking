import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { SessionsModule } from './sessions/sessions.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb+srv://eyetrackseye_db_user:My123456@eyetrackseye.ylwpyar.mongodb.net/eye-tracking?retryWrites=true&w=majority'),
    // ConfigModule.forRoot(),
    // MongooseModule.forRoot(process.env.MONGO_URL as string),
    //MongooseModule.forRoot('mongodb://root:2cz9oAAuzLXWeLqyKBVriBDl@eyetrackingdb:27017/my-app?authSource=admin'),

    UsersModule,
    AuthModule,
    SessionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
