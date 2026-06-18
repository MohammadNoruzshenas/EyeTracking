import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { SessionsGateway } from './sessions.gateway';
import { Session, SessionSchema } from './schemas/session.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Session.name, schema: SessionSchema }]),
        AuthModule,
    ],
    controllers: [SessionsController],
    providers: [SessionsService, SessionsGateway],
    exports: [SessionsService],
})
export class SessionsModule { }
